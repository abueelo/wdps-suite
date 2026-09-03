import { requireOwner, getLog, json } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  return json(await getLog(env));
}
