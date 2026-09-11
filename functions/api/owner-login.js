// GitHub OAuth kickoff for the owner console — same flow as the portfolio
// site's /api/login, needs its own GitHub OAuth App (see CLOUDFLARE.md).
// Shared by upload-portal's owner console and presenter's login gate —
// one OAuth app, one callback URL, so where to bounce back to on success
// is passed through as `return_to` and stashed in a cookie for the
// callback to read, rather than needing a second registered callback URL.
import { randomHex, secureFlag } from '../_lib.js';

const RETURN_TARGETS = new Set(['/upload-portal/owner.html', '/presenter/', '/knockout/']);
const DEFAULT_RETURN = '/upload-portal/owner.html';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('return_to');
  const returnTo = RETURN_TARGETS.has(requested) ? requested : DEFAULT_RETURN;

  const state = randomHex();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/api/owner-callback`);
  authorize.searchParams.set('state', state);

  const headers = new Headers({ Location: authorize.toString() });
  headers.append('Set-Cookie', `oauth_state=${state}; HttpOnly;${secureFlag(request)} SameSite=Lax; Path=/; Max-Age=600`);
  headers.append('Set-Cookie', `owner_return_to=${returnTo}; HttpOnly;${secureFlag(request)} SameSite=Lax; Path=/; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}
