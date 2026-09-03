// Built now, unreached until the member gate is switched on (see
// PortalSettings.memberGateEnabled and requireMemberOrAdmin in _lib.js).
import { checkPasscodeForRole, makeSessionCookie, appendLog, json } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  if (!(await checkPasscodeForRole(env, 'member', body.passcode))) {
    await appendLog(env, 'member.login.failed');
    return json({ error: 'wrong passcode' }, { status: 401 });
  }

  await appendLog(env, 'member.login.success');
  return json({ ok: true }, { headers: { 'Set-Cookie': await makeSessionCookie(request, env, 'member') } });
}
