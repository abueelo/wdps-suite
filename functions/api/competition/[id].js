import { requireAdmin, validId, entryImageKey, appendLog, json } from '../../_lib.js';

const COMPETITIONS_KEY = 'competitions';
const MAX_LEN = { name: 120 };

async function loadCompetitions(env) {
  return (await env.COMPETITIONS_KV.get(COMPETITIONS_KEY, 'json')) || [];
}

export async function onRequestGet({ request, env, params }) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }
  const competition = (await loadCompetitions(env)).find((c) => c.id === params.id);
  if (!competition) return json({ error: 'not found' }, { status: 404 });
  return json(competition);
}

export async function onRequestPatch({ request, env, params }) {
  if (!(await requireAdmin(request, env))) {
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

  const all = await loadCompetitions(env);
  const competition = all.find((c) => c.id === params.id);
  if (!competition) return json({ error: 'not found' }, { status: 404 });

  if (typeof body.name === 'string' && body.name.trim()) {
    competition.name = body.name.trim().slice(0, MAX_LEN.name);
  }
  if ((body.status === 'open' || body.status === 'locked') && body.status !== competition.status) {
    competition.status = body.status;
    await appendLog(env, body.status === 'locked' ? 'competition.lock' : 'competition.reopen', competition.name);
  }

  await env.COMPETITIONS_KV.put(COMPETITIONS_KEY, JSON.stringify(all));
  return json(competition);
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }

  const all = await loadCompetitions(env);
  const competition = all.find((c) => c.id === params.id);
  if (!competition) return json({ error: 'not found' }, { status: 404 });

  const entriesKey = `entries:${params.id}`;
  const entries = (await env.COMPETITIONS_KV.get(entriesKey, 'json')) || [];
  const objectKeys = entries.flatMap((e) => [entryImageKey(params.id, e.id, 'orig'), entryImageKey(params.id, e.id, 'thumb')]);
  if (objectKeys.length > 0) {
    await env.ENTRY_IMAGES.delete(objectKeys);
  }
  await env.COMPETITIONS_KV.delete(entriesKey);

  const remaining = all.filter((c) => c.id !== params.id);
  await env.COMPETITIONS_KV.put(COMPETITIONS_KEY, JSON.stringify(remaining));
  await appendLog(env, 'competition.delete', competition.name);

  return json({ ok: true });
}
