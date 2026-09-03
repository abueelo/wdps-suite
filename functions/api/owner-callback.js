import { OWNER, getCookie, makeSessionCookie, secureFlag, appendLog } from '../_lib.js';

const CONSOLE_PATH = '/upload-portal/owner.html';

function bounce(location, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: location, ...extraHeaders } });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = getCookie(request, 'oauth_state');
  const clearState = `oauth_state=; HttpOnly;${secureFlag(request)} SameSite=Lax; Path=/; Max-Age=0`;

  if (!code || !state || !savedState || state !== savedState) {
    return bounce(`${CONSOLE_PATH}#error-state`, { 'Set-Cookie': clearState });
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/owner-callback`
    })
  });
  const tokenBody = await tokenRes.json();
  if (!tokenBody.access_token) {
    return bounce(`${CONSOLE_PATH}#error-token`, { 'Set-Cookie': clearState });
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'wdps-upload-portal'
    }
  });
  const userBody = await userRes.json();
  if (!userBody.login) {
    return bounce(`${CONSOLE_PATH}#error-user`, { 'Set-Cookie': clearState });
  }

  if (userBody.login !== OWNER) {
    await appendLog(env, 'owner.login.denied', userBody.login);
    return bounce(`${CONSOLE_PATH}#denied`, { 'Set-Cookie': clearState });
  }

  await appendLog(env, 'owner.login.success');
  const headers = new Headers({ Location: CONSOLE_PATH });
  headers.append('Set-Cookie', clearState);
  headers.append('Set-Cookie', await makeSessionCookie(request, env, 'owner'));
  return new Response(null, { status: 302, headers });
}
