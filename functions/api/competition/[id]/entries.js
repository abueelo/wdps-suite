import {
  requireAdmin,
  requireMemberOrAdmin,
  validId,
  newId,
  entryImageKey,
  extFromFilename,
  familyForExt,
  contentTypeForFamily,
  sniffEntryFormat,
  json
} from '../../../_lib.js';

const COMPETITIONS_KEY = 'competitions';
const MAX_ORIGINAL_BYTES = 60 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES_PER_COMPETITION = 500;
const MAX_LEN = { photographer: 120, title: 120, filename: 200 };

function entriesKeyFor(competitionId) {
  return `entries:${competitionId}`;
}

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

  const entries = (await env.COMPETITIONS_KV.get(entriesKeyFor(params.id), 'json')) || [];
  const withUrls = entries.map((e) => ({
    ...e,
    thumbnailUrl: `/api/entry-image/${entryImageKey(params.id, e.id, 'thumb')}`,
    originalUrl: `/api/entry-image/${entryImageKey(params.id, e.id, 'orig')}`
  }));

  return json({ competition, entries: withUrls });
}

export async function onRequestPost({ request, env, params }) {
  if (!(await requireMemberOrAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!validId(params.id)) {
    return json({ error: 'invalid id' }, { status: 400 });
  }

  const all = await loadCompetitions(env);
  const competition = all.find((c) => c.id === params.id);
  if (!competition) return json({ error: 'not found' }, { status: 404 });
  if (competition.status !== 'open') {
    return json({ error: 'this competition is not accepting entries' }, { status: 409 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const original = form.get('original');
  const thumbnail = form.get('thumbnail');
  const photographer = String(form.get('photographer') || '').trim().slice(0, MAX_LEN.photographer);
  const title = String(form.get('title') || '').trim().slice(0, MAX_LEN.title);
  const filename = String(form.get('filename') || '').trim().slice(0, MAX_LEN.filename);
  const width = Number(form.get('width'));
  const height = Number(form.get('height'));

  if (!(original instanceof Blob) || original.size === 0 || original.size > MAX_ORIGINAL_BYTES) {
    return json({ error: `original file must be between 1 byte and ${MAX_ORIGINAL_BYTES / (1024 * 1024)}MB` }, { status: 400 });
  }
  if (!(thumbnail instanceof Blob) || thumbnail.size === 0 || thumbnail.size > MAX_THUMBNAIL_BYTES) {
    return json({ error: 'missing or oversized thumbnail' }, { status: 400 });
  }
  if (!photographer || !title) {
    return json({ error: 'photographer and title are required' }, { status: 400 });
  }

  const ext = extFromFilename(filename);
  const family = familyForExt(ext);
  if (!family) {
    return json({ error: 'only .tif/.tiff/.png/.jpg/.jpeg files are accepted' }, { status: 400 });
  }

  const originalBuf = await original.arrayBuffer();
  const sniffed = sniffEntryFormat(originalBuf);
  if (sniffed !== family) {
    return json({ error: "file contents don't match its extension" }, { status: 400 });
  }

  const entries = (await env.COMPETITIONS_KV.get(entriesKeyFor(params.id), 'json')) || [];
  if (entries.length >= MAX_ENTRIES_PER_COMPETITION) {
    return json({ error: 'entry limit reached for this competition' }, { status: 400 });
  }

  const entryId = newId();
  await Promise.all([
    env.ENTRY_IMAGES.put(entryImageKey(params.id, entryId, 'orig'), originalBuf, {
      httpMetadata: { contentType: contentTypeForFamily(family) }
    }),
    env.ENTRY_IMAGES.put(entryImageKey(params.id, entryId, 'thumb'), await thumbnail.arrayBuffer(), {
      httpMetadata: { contentType: 'image/jpeg' }
    })
  ]);

  const entry = {
    id: entryId,
    competitionId: params.id,
    photographer,
    title,
    originalFilename: filename || `${entryId}.${ext}`,
    contentType: contentTypeForFamily(family),
    ext,
    size: original.size,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : null,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
    uploadedAt: Date.now(),
    excluded: false
  };
  entries.push(entry);
  await env.COMPETITIONS_KV.put(entriesKeyFor(params.id), JSON.stringify(entries));

  competition.entryCount = entries.length;
  await env.COMPETITIONS_KV.put(COMPETITIONS_KEY, JSON.stringify(all));

  return json(entry);
}
