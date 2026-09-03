import { requireOwner, hashPasscode, getSettings, putSettings, appendLog, json } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  if (body.role !== 'admin' && body.role !== 'member') {
    return json({ error: 'role must be "admin" or "member"' }, { status: 400 });
  }
  if (typeof body.passcode !== 'string' || body.passcode.length < 4) {
    return json({ error: 'passcode must be at least 4 characters' }, { status: 400 });
  }

  const settings = await getSettings(env);
  const hash = await hashPasscode(env, body.passcode);
  if (body.role === 'admin') {
    settings.adminPasscodeHash = hash;
  } else {
    settings.memberPasscodeHash = hash;
  }
  await putSettings(env, settings);
  await appendLog(env, 'passcode.reset', body.role);

  return json({ ok: true });
}
