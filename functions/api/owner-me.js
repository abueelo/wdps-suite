import { isOwner, json } from '../_lib.js';

export async function onRequestGet({ request, env }) {
  return json({ authed: await isOwner(request, env) });
}
