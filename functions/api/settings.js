import { requireAdmin, getSettings, putSettings, json } from '../_lib.js';

export async function onRequestGet({ env }) {
  return json(await getSettings(env));
}

export async function onRequestPut({ request, env }) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }
  await putSettings(env, { memberGateEnabled: !!body.memberGateEnabled });
  return json(await getSettings(env));
}
