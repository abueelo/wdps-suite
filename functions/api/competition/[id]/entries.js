import {
  requireAdmin,
  requireMemberOrAdmin,
  validId,
  newId,
  entryImageKey,
  extFromFilename,
  familyForExt,
  contentTypeForFamily,
  sniffEntryFormat,
  samePhotographer,
  PHOTOGRAPHER_MAX_LEN,
  displayFilename,
  rankByPhotographer,
  appendLog,
  json
} from '../../../_lib.js';

const COMPETITIONS_KEY = 'competitions';
const MAX_ORIGINAL_BYTES = 60 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES_PER_COMPETITION = 500;
const MAX_LEN = { photographer: PHOTOGRAPHER_MAX_LEN, title: 120, filename: 200 };

function entriesKeyFor(competitionId) {
  return `entries:${competitionId}`;
}

async function loadCompetitions(env) {
  return (await env.COMPETITIONS_KV.get(COMPETITIONS_KEY, 'json')) || [];
}

export async function onRequestGet({ request, env, params }) {
  // Whether this is the "my uploads" view or the admin's full view is
  // decided by whether a photographer name was asked for — not by whether
  // the caller happens to also hold an admin session. Otherwise someone
  // with an admin session active in the same browser (e.g. while testing)
  // would see everyone's entries on the member upload page too, since that
  // request would satisfy requireAdmin without ever passing a name.
  const rawPhotographer = new URL(request.url).searchParams.get('photographer');
  let photographer = null;
  if (rawPhotographer !== null) {
    if (!(await requireMemberOrAdmin(request, env))) {
      return json({ error: 'not authorised' }, { status: 401 });
    }
    photographer = rawPhotographer.trim().slice(0, PHOTOGRAPHER_MAX_LEN);
    if (!photographer) {
      return json({ error: 'photographer is required' }, { status: 400 });
    }
  } else if (!(await requireAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }
  const competition = (await loadCompetitions(env)).find((c) => c.id === params.id);
  if (!competition) return json({ error: 'not found' }, { status: 404 });

  const allEntries = (await env.COMPETITIONS_KV.get(entriesKeyFor(params.id), 'json')) || [];
  // Ranked over the full list, not whatever subset a member sees, so the
  // number in an entry's display name never depends on who's asking.
  const ranks = rankByPhotographer(allEntries);
  let entries = allEntries;
  if (photographer !== null) {
    entries = entries.filter((e) => samePhotographer(e.photographer, photographer));
  }
  const withUrls = entries.map((e) => ({
    ...e,
    originalFilename: displayFilename(ranks.get(e.id), e.photographer, e.title, e.ext),
    thumbnailUrl: `/api/entry-image/${entryImageKey(params.id, e.id, 'thumb')}`,
    originalUrl: `/api/entry-image/${entryImageKey(params.id, e.id, 'orig')}`
  }));

  return json({ competition, entries: withUrls });
}

export async function onRequestPost({ request, env, params }) {
  if (!(await requireMemberOrAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }

  const all = await loadCompetitions(env);
  const competition = all.find((c) => c.id === params.id);
  if (!competition) return json({ error: 'not found' }, { status: 404 });
  if (competition.status !== 'open') {
    return json({ error: 'this competition is not accepting entries' }, { status: 409 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const original = form.get('original');
  const thumbnail = form.get('thumbnail');
  const photographer = String(form.get('photographer') || '').trim().slice(0, MAX_LEN.photographer);
  const title = String(form.get('title') || '').trim().slice(0, MAX_LEN.title);
  const filename = String(form.get('filename') || '').trim().slice(0, MAX_LEN.filename);
  const width = Number(form.get('width'));
  const height = Number(form.get('height'));

  if (!(original instanceof Blob) || original.size === 0 || original.size > MAX_ORIGINAL_BYTES) {
    return json({ error: `image must be just under ${MAX_ORIGINAL_BYTES / (1024 * 1024)}MB` }, { status: 400 });
  }
  if (!(thumbnail instanceof Blob) || thumbnail.size === 0 || thumbnail.size > MAX_THUMBNAIL_BYTES) {
    return json({ error: 'missing or oversized thumbnail' }, { status: 400 });
  }
  if (!photographer || !title) {
    return json({ error: 'photographer and title are required' }, { status: 400 });
  }

  const ext = extFromFilename(filename);
  const family = familyForExt(ext);
  if (!family) {
    return json({ error: 'only .tif/.tiff/.png/.jpg/.jpeg files are accepted' }, { status: 400 });
  }

  const originalBuf = await original.arrayBuffer();
  const sniffed = sniffEntryFormat(originalBuf);
  if (sniffed !== family) {
    return json({ error: "file contents don't match its extension" }, { status: 400 });
  }

  const entries = (await env.COMPETITIONS_KV.get(entriesKeyFor(params.id), 'json')) || [];
  if (entries.length >= MAX_ENTRIES_PER_COMPETITION) {
    return json({ error: 'entry limit reached for this competition' }, { status: 400 });
  }

  const entryId = newId();
  await Promise.all([
    env.ENTRY_IMAGES.put(entryImageKey(params.id, entryId, 'orig'), originalBuf, {
      httpMetadata: { contentType: contentTypeForFamily(family) }
    }),
    env.ENTRY_IMAGES.put(entryImageKey(params.id, entryId, 'thumb'), await thumbnail.arrayBuffer(), {
      httpMetadata: { contentType: 'image/jpeg' }
    })
  ]);

  const entry = {
    id: entryId,
    competitionId: params.id,
    photographer,
    title,
    originalFilename: filename || `${entryId}.${ext}`,
    contentType: contentTypeForFamily(family),
    ext,
    size: original.size,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : null,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
    uploadedAt: Date.now(),
    excluded: false
  };
  entries.push(entry);
  await env.COMPETITIONS_KV.put(entriesKeyFor(params.id), JSON.stringify(entries));

  competition.entryCount = entries.length;
  await env.COMPETITIONS_KV.put(COMPETITIONS_KEY, JSON.stringify(all));
  await appendLog(env, 'entry.upload', `${title} — ${photographer} (${competition.name})`);

  const ranks = rankByPhotographer(entries);
  return json({
    ...entry,
    originalFilename: displayFilename(ranks.get(entryId), entry.photographer, entry.title, entry.ext),
    thumbnailUrl: `/api/entry-image/${entryImageKey(params.id, entryId, 'thumb')}`,
    originalUrl: `/api/entry-image/${entryImageKey(params.id, entryId, 'orig')}`
  });
}

// Lets a member set the order they'd like their own entries considered in
// (best shot first) — this is also the order comp-sheets numbers entries
// in (01_, 02_, ...) once a competition moves over, via its per-photographer
// `priority`, which it assigns from the order entries arrive in. Only the
// positions occupied by this photographer's own entries change; everyone
// else's stay exactly where they were.
function reorderPhotographerEntries(entries, photographer, orderedIds) {
  const mineIndices = [];
  const mineById = new Map();
  entries.forEach((e, i) => {
    if (samePhotographer(e.photographer, photographer)) {
      mineIndices.push(i);
      mineById.set(e.id, e);
    }
  });
  if (orderedIds.length !== mineIndices.length || !orderedIds.every((id) => mineById.has(id))) {
    return null;
  }
  const next = [...entries];
  orderedIds.forEach((id, i) => {
    next[mineIndices[i]] = mineById.get(id);
  });
  return next;
}

export async function onRequestPatch({ request, env, params }) {
  if (!(await requireMemberOrAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  const photographer = String(body.photographer || '').trim().slice(0, PHOTOGRAPHER_MAX_LEN);
  const order = Array.isArray(body.order) ? body.order : null;
  if (!photographer || !order || order.length === 0 || !order.every((id) => typeof id === 'string')) {
    return json({ error: 'photographer and order are required' }, { status: 400 });
  }

  const all = await loadCompetitions(env);
  const competition = all.find((c) => c.id === params.id);
  if (!competition) return json({ error: 'not found' }, { status: 404 });
  if (competition.status !== 'open') {
    return json({ error: 'this competition is no longer accepting changes' }, { status: 409 });
  }

  const entriesKey = entriesKeyFor(params.id);
  const entries = (await env.COMPETITIONS_KV.get(entriesKey, 'json')) || [];
  const reordered = reorderPhotographerEntries(entries, photographer, order);
  if (!reordered) {
    return json({ error: 'order must list exactly this photographer’s own entries' }, { status: 400 });
  }

  await env.COMPETITIONS_KV.put(entriesKey, JSON.stringify(reordered));

  const ranks = rankByPhotographer(reordered);
  const mine = reordered
    .filter((e) => samePhotographer(e.photographer, photographer))
    .map((e) => ({
      ...e,
      originalFilename: displayFilename(ranks.get(e.id), e.photographer, e.title, e.ext),
      thumbnailUrl: `/api/entry-image/${entryImageKey(params.id, e.id, 'thumb')}`,
      originalUrl: `/api/entry-image/${entryImageKey(params.id, e.id, 'orig')}`
    }));

  return json({ competition, entries: mine });
}
