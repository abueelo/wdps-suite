import { requireOwner, entryImageKey, appendLog, json } from '../_lib.js';

const COMPETITIONS_KEY = 'competitions';
// R2's delete() takes at most 1000 keys per call.
const R2_DELETE_BATCH = 1000;

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
  if (body.scope !== 'images' && body.scope !== 'full') {
    return json({ error: 'scope must be "images" or "full"' }, { status: 400 });
  }

  const competitions = (await env.COMPETITIONS_KV.get(COMPETITIONS_KEY, 'json')) || [];

  let imagesDeleted = 0;
  let entriesAffected = 0;

  for (const competition of competitions) {
    const entriesKey = `entries:${competition.id}`;
    const entries = (await env.COMPETITIONS_KV.get(entriesKey, 'json')) || [];
    const objectKeys = entries.flatMap((e) => [entryImageKey(competition.id, e.id, 'orig'), entryImageKey(competition.id, e.id, 'thumb')]);

    for (let i = 0; i < objectKeys.length; i += R2_DELETE_BATCH) {
      await env.ENTRY_IMAGES.delete(objectKeys.slice(i, i + R2_DELETE_BATCH));
    }
    imagesDeleted += objectKeys.length;
    entriesAffected += entries.length;

    // images-only leaves the entry records in place — their thumbnails
    // will 404 from here on, the accepted tradeoff of the narrower option.
    if (body.scope === 'full') {
      await env.COMPETITIONS_KV.delete(entriesKey);
    }
  }

  if (body.scope === 'full') {
    await env.COMPETITIONS_KV.put(COMPETITIONS_KEY, JSON.stringify([]));
  }

  await appendLog(
    env,
    'storage.wipe',
    `${body.scope} — ${imagesDeleted} images, ${entriesAffected} entries across ${competitions.length} competitions`
  );

  return json({ ok: true, scope: body.scope, imagesDeleted, entriesAffected, competitionsAffected: competitions.length });
}
