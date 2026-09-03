import { requireAdmin, validId, entryImageKey, json } from '../../../../_lib.js';

const COMPETITIONS_KEY = 'competitions';

function entriesKeyFor(competitionId) {
  return `entries:${competitionId}`;
}

export async function onRequestPatch({ request, env, params }) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id) || !validId(params.entryId)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  const entries = (await env.COMPETITIONS_KV.get(entriesKeyFor(params.id), 'json')) || [];
  const entry = entries.find((e) => e.id === params.entryId);
  if (!entry) return json({ error: 'not found' }, { status: 404 });

  entry.excluded = !!body.excluded;
  await env.COMPETITIONS_KV.put(entriesKeyFor(params.id), JSON.stringify(entries));
  return json(entry);
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id) || !validId(params.entryId)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }

  const entriesKey = entriesKeyFor(params.id);
  const entries = (await env.COMPETITIONS_KV.get(entriesKey, 'json')) || [];
  const remaining = entries.filter((e) => e.id !== params.entryId);
  if (remaining.length === entries.length) {
    return json({ error: 'not found' }, { status: 404 });
  }

  await env.ENTRY_IMAGES.delete([entryImageKey(params.id, params.entryId, 'orig'), entryImageKey(params.id, params.entryId, 'thumb')]);
  await env.COMPETITIONS_KV.put(entriesKey, JSON.stringify(remaining));

  const all = (await env.COMPETITIONS_KV.get(COMPETITIONS_KEY, 'json')) || [];
  const competition = all.find((c) => c.id === params.id);
  if (competition) {
    competition.entryCount = remaining.length;
    await env.COMPETITIONS_KV.put(COMPETITIONS_KEY, JSON.stringify(all));
  }

  return json({ ok: true });
}
