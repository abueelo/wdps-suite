import { requireAdmin, newId, appendLog, json } from '../_lib.js';

const KEY = 'competitions';
const MAX_COMPETITIONS = 100;
const MAX_LEN = { name: 120 };

async function loadAll(env) {
  return (await env.COMPETITIONS_KV.get(KEY, 'json')) || [];
}

export async function onRequestGet({ request, env }) {
  const all = await loadAll(env);
  const url = new URL(request.url);
  if (url.searchParams.get('all') && (await requireAdmin(request, env))) {
    return json(all);
  }
  return json(all.filter((c) => c.status === 'open'));
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_LEN.name) : '';
  if (!name) {
    return json({ error: 'name is required' }, { status: 400 });
  }

  const all = await loadAll(env);
  if (all.length >= MAX_COMPETITIONS) {
    return json({ error: 'competition limit reached' }, { status: 400 });
  }

  const num = (v) => (Number.isFinite(v) ? v : null);
  const competition = {
    id: newId(),
    name,
    createdAt: Date.now(),
    opensAt: num(body.opensAt) ?? null,
    closesAt: num(body.closesAt) ?? null,
    status: 'open',
    entryCount: 0
  };

  all.push(competition);
  await env.COMPETITIONS_KV.put(KEY, JSON.stringify(all));
  await appendLog(env, 'competition.create', name);
  return json(competition);
}
