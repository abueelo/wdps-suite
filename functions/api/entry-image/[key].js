import { requireMemberOrAdmin, ENTRY_IMAGE_KEY_RE, json } from '../../_lib.js';

export async function onRequestGet({ request, env, params }) {
  // Members now fetch their own entries' images too (their "my uploads"
  // list), so this needs the same gate as .../entries rather than admin-only.
  if (!(await requireMemberOrAdmin(request, env))) {
    return json({ error: 'not authorised' }, { status: 401 });
  }
  if (!ENTRY_IMAGE_KEY_RE.test(params.key)) {
    return json({ error: 'invalid key' }, { status: 400 });
  }

  const object = await env.ENTRY_IMAGES.get(params.key);
  if (!object) return json({ error: 'not found' }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Content-Length', String(object.size));

  return new Response(object.body, { headers });
}
