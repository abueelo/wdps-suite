import { clearSessionCookie, json } from '../_lib.js';

export async function onRequestGet({ request }) {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request, 'admin') } });
}
