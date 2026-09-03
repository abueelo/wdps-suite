// GitHub OAuth kickoff for the owner console — same flow as the portfolio
// site's /api/login, needs its own GitHub OAuth App (see CLOUDFLARE.md).
import { randomHex, secureFlag } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  const state = randomHex();
  const origin = new URL(request.url).origin;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${origin}/api/owner-callback`);
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `oauth_state=${state}; HttpOnly;${secureFlag(request)} SameSite=Lax; Path=/; Max-Age=600`
    }
  });
}
