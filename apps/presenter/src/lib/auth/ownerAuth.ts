// presenter is still under development — gated behind the same owner
// login as upload-portal's owner console (functions/api/owner-*.js):
// GitHub OAuth, hardcoded to a single allowed login, one shared
// owner_session cookie good across every app on the domain. Login/logout
// are plain redirects/fetches against those existing endpoints — nothing
// presenter-specific on the server beyond `return_to` support in
// owner-login/owner-callback so a login started here lands back here.

const RETURN_TO = '/presenter/';

export const LOGIN_URL = `/api/owner-login?return_to=${encodeURIComponent(RETURN_TO)}`;

export async function checkOwnerAuth(): Promise<boolean> {
  try {
    const res = await fetch('/api/owner-me');
    if (!res.ok) return false;
    const body = await res.json();
    return body.authed === true;
  } catch {
    return false;
  }
}

export async function ownerLogout(): Promise<void> {
  await fetch('/api/owner-logout');
}
