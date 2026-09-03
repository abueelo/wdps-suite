// Shared helpers for the upload-portal Functions. Same shape as a signed-
// cookie session + KV/R2 storage pattern used elsewhere (portfolio site),
// but self-contained here — its own secrets, its own KV namespace, its own
// R2 bucket. Nothing shared between the two.

const SESSION_DAYS = 7;
const KV_KEY_SETTINGS = 'settings';
const KV_KEY_LOG = 'log';
const MAX_LOG_ROWS = 500;

// The one GitHub account allowed into the owner console — hardcoded like
// portfolio_site's OWNER, since it's not meant to change.
export const OWNER = 'abueelo';

const enc = new TextEncoder();

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function digestHex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Fixed-length hex strings in, so this is effectively constant-time —
// avoids a short-circuiting !== on user-influenced session/passcode checks.
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function secureFlag(request) {
  return new URL(request.url).protocol === 'https:' ? ' Secure;' : '';
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

const COOKIE_NAME = { admin: 'admin_session', member: 'member_session', owner: 'owner_session' };

export async function makeSessionCookie(request, env, role) {
  const expiry = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${role}.${expiry}`;
  const sig = await hmac(env.SESSION_SECRET, payload);
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME[role]}=${payload}.${sig}; HttpOnly;${secureFlag(request)} SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(request, role) {
  return `${COOKIE_NAME[role]}=; HttpOnly;${secureFlag(request)} SameSite=Lax; Path=/; Max-Age=0`;
}

async function hasSession(request, env, role) {
  const raw = getCookie(request, COOKIE_NAME[role]);
  if (!raw) return false;
  const [cookieRole, expiry, sig] = raw.split('.');
  if (cookieRole !== role || !expiry || !sig) return false;
  if (Number(expiry) < Date.now()) return false;
  const expected = await hmac(env.SESSION_SECRET, `${cookieRole}.${expiry}`);
  return timingSafeEqualHex(sig, expected);
}

export async function isAdmin(request, env) {
  return hasSession(request, env, 'admin');
}

export async function isMember(request, env) {
  return hasSession(request, env, 'member');
}

export async function isOwner(request, env) {
  return hasSession(request, env, 'owner');
}

// The owner is a strict superset of admin — GitHub-authed owner sessions
// pass admin checks too, so there's no dead end where you're logged into
// the owner console but locked out of the regular admin screens.
export async function requireAdmin(request, env) {
  if (await isOwner(request, env)) return true;
  return isAdmin(request, env);
}

export async function requireOwner(request, env) {
  return isOwner(request, env);
}

/**
 * Gate for member uploads. When the member gate is off (the default —
 * see PortalSettings) this is a no-op that lets anyone through, so the
 * portal works with zero friction today. Flipping `memberGateEnabled` on
 * later (via the admin settings panel) is the only step needed to start
 * enforcing MEMBER_PASSCODE — no code path changes.
 */
export async function requireMemberOrAdmin(request, env) {
  if (await isOwner(request, env)) return true;
  if (await isAdmin(request, env)) return true;
  const settings = await getSettings(env);
  if (!settings.memberGateEnabled) return true;
  return isMember(request, env);
}

export async function checkPasscode(candidate, expected) {
  if (typeof candidate !== 'string' || !candidate || !expected) return false;
  const [a, b] = await Promise.all([digestHex(candidate), digestHex(expected)]);
  return timingSafeEqualHex(a, b);
}

// Keyed hash for passcodes the owner has reset from the console — not
// reversible from the stored value alone (needs SESSION_SECRET too), so a
// KV read doesn't hand over the plaintext passcode. Reuses the existing
// hmac() helper rather than adding new crypto.
export async function hashPasscode(env, passcode) {
  return hmac(env.SESSION_SECRET, `passcode:${passcode}`);
}

/**
 * Checks a candidate passcode against whichever is authoritative right
 * now: an owner-set hash in KV settings if one exists, otherwise the
 * env var it started out as. This is what makes passcodes resettable
 * from the owner console without a Cloudflare dashboard edit + redeploy —
 * the first reset just switches the authoritative source over.
 */
export async function checkPasscodeForRole(env, role, candidate) {
  const settings = await getSettings(env);
  const storedHash = role === 'admin' ? settings.adminPasscodeHash : settings.memberPasscodeHash;
  if (storedHash) {
    if (typeof candidate !== 'string' || !candidate) return false;
    return timingSafeEqualHex(await hashPasscode(env, candidate), storedHash);
  }
  const envVar = role === 'admin' ? env.ADMIN_PASSCODE : env.MEMBER_PASSCODE;
  return checkPasscode(candidate, envVar);
}

export async function getSettings(env) {
  return (await env.COMPETITIONS_KV.get(KV_KEY_SETTINGS, 'json')) || { memberGateEnabled: false };
}

export async function putSettings(env, settings) {
  await env.COMPETITIONS_KV.put(KV_KEY_SETTINGS, JSON.stringify(settings));
}

/**
 * Appends one row to the owner-visible audit log (newest first, capped —
 * oldest dropped past MAX_LOG_ROWS, same style as photos.js's MAX_ROWS).
 * Never throws: a logging hiccup should never break the action it's
 * logging, so failures are swallowed here rather than propagated.
 */
export async function appendLog(env, type, detail) {
  try {
    const log = (await env.COMPETITIONS_KV.get(KV_KEY_LOG, 'json')) || [];
    log.unshift({ id: newId(), at: Date.now(), type, detail: detail || '' });
    await env.COMPETITIONS_KV.put(KV_KEY_LOG, JSON.stringify(log.slice(0, MAX_LOG_ROWS)));
  } catch {
    // best-effort — see comment above
  }
}

export async function getLog(env) {
  return (await env.COMPETITIONS_KV.get(KV_KEY_LOG, 'json')) || [];
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {})
    }
  });
}

export function randomHex(bytes = 16) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newId() {
  return Date.now().toString(36) + '-' + randomHex(4);
}

export function validId(id) {
  return typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id);
}

// Accepted formats mirror comp-sheets' upload validation
// (apps/comp-sheets/src/lib/upload/collectFiles.ts): tiff, png, jpeg,
// magic-byte sniffed rather than trusted from the extension alone.
const EXT_FAMILY = { tif: 'tiff', tiff: 'tiff', png: 'png', jpg: 'jpeg', jpeg: 'jpeg' };
const FAMILY_CONTENT_TYPE = { tiff: 'image/tiff', png: 'image/png', jpeg: 'image/jpeg' };

export function extFromFilename(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

export function familyForExt(ext) {
  return EXT_FAMILY[ext] || null;
}

export function contentTypeForFamily(family) {
  return FAMILY_CONTENT_TYPE[family] || null;
}

/** Magic-byte sniff — returns 'tiff' | 'png' | 'jpeg' | null. */
export function sniffEntryFormat(buf) {
  const b = new Uint8Array(buf);
  if (b.length < 4) return null;
  if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) return 'tiff'; // little-endian TIFF
  if (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a) return 'tiff'; // big-endian TIFF
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  return null;
}

export function entryImageKey(competitionId, entryId, kind) {
  return `entry-${competitionId}-${entryId}-${kind}`;
}

export const ENTRY_IMAGE_KEY_RE = /^entry-[a-z0-9-]{1,60}-(orig|thumb)$/;
