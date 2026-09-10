import { OWNER, getCookie, makeSessionCookie, secureFlag, appendLog } from '../_lib.js';

const RETURN_TARGETS = new Set(['/upload-portal/owner.html', '/presenter/']);
const DEFAULT_RETURN = '/upload-portal/owner.html';

function clearCookies(request) {
  const flag = secureFlag(request);
  return [
    `oauth_state=; HttpOnly;${flag} SameSite=Lax; Path=/; Max-Age=0`,
    `owner_return_to=; HttpOnly;${flag} SameSite=Lax; Path=/; Max-Age=0`
  ];
}

function bounce(location, cookies) {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = getCookie(request, 'oauth_state');
  const savedReturnTo = getCookie(request, 'owner_return_to');
  const returnTo = RETURN_TARGETS.has(savedReturnTo) ? savedReturnTo : DEFAULT_RETURN;

  if (!code || !state || !savedState || state !== savedState) {
    return bounce(`${returnTo}#error-state`, clearCookies(request));
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
    return bounce(`${returnTo}#error-token`, clearCookies(request));
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
    return bounce(`${returnTo}#error-user`, clearCookies(request));
  }

  if (userBody.login !== OWNER) {
    await appendLog(env, 'owner.login.denied', userBody.login);
    return bounce(`${returnTo}#denied`, clearCookies(request));
  }

  await appendLog(env, 'owner.login.success');
  const headers = new Headers({ Location: returnTo });
  for (const cookie of clearCookies(request)) headers.append('Set-Cookie', cookie);
  headers.append('Set-Cookie', await makeSessionCookie(request, env, 'owner'));
  return new Response(null, { status: 302, headers });
}
