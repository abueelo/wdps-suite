import { requireAdmin, requireMemberOrAdmin, validId, entryImageKey, samePhotographer, appendLog, json } from '../../../../_lib.js';

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
  await appendLog(env, entry.excluded ? 'entry.exclude' : 'entry.restore', entry.title);
  return json(entry);
}

export async function onRequestDelete({ request, env, params }) {
  // Admin can delete anything, any time. A non-admin caller can only take
  // back their own entry (matched by the name they typed, same as GET
  // .../entries) and only while the competition is still open — once it's
  // locked for judging, entries are frozen the same way new uploads are.
  const admin = await requireAdmin(request, env);
  if (!admin && !(await requireMemberOrAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id) || !validId(params.entryId)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }

  const all = (await env.COMPETITIONS_KV.get(COMPETITIONS_KEY, 'json')) || [];
  const competition = all.find((c) => c.id === params.id);

  const entriesKey = entriesKeyFor(params.id);
  const entries = (await env.COMPETITIONS_KV.get(entriesKey, 'json')) || [];
  const entry = entries.find((e) => e.id === params.entryId);
  if (!entry) return json({ error: 'not found' }, { status: 404 });

  let selfRemoved = false;
  if (!admin) {
    const photographer = new URL(request.url).searchParams.get('photographer') || '';
    if (!samePhotographer(entry.photographer, photographer)) {
      return json({ error: 'not authorised' }, { status: 403 });
    }
    if (!competition || competition.status !== 'open') {
      return json({ error: 'this competition is no longer accepting changes' }, { status: 409 });
    }
    selfRemoved = true;
  }

  const remaining = entries.filter((e) => e.id !== params.entryId);
  await env.ENTRY_IMAGES.delete([entryImageKey(params.id, params.entryId, 'orig'), entryImageKey(params.id, params.entryId, 'thumb')]);
  await env.COMPETITIONS_KV.put(entriesKey, JSON.stringify(remaining));

  if (competition) {
    competition.entryCount = remaining.length;
    await env.COMPETITIONS_KV.put(COMPETITIONS_KEY, JSON.stringify(all));
  }
  await appendLog(env, 'entry.delete', selfRemoved ? `${entry.title} (removed by ${entry.photographer})` : entry.title);

  return json({ ok: true });
}
