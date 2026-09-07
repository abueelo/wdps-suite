// Entry point for the Worker. wdps-suite is deployed as a plain Worker
// with static assets (not Cloudflare Pages), so there's no automatic
// functions/-directory routing — this router dispatches to the exact
// same handlers under functions/api/ by matching method + path, then
// falls through to serving dist/ for everything else.
import * as adminLogin from './functions/api/admin-login.js';
import * as adminLogout from './functions/api/admin-logout.js';
import * as adminMe from './functions/api/admin-me.js';
import * as memberLogin from './functions/api/member-login.js';
import * as settings from './functions/api/settings.js';
import * as competitions from './functions/api/competitions.js';
import * as competitionId from './functions/api/competition/[id].js';
import * as entries from './functions/api/competition/[id]/entries.js';
import * as entryId from './functions/api/competition/[id]/entry/[entryId].js';
import * as entryImage from './functions/api/entry-image/[key].js';
import * as ownerLogin from './functions/api/owner-login.js';
import * as ownerCallback from './functions/api/owner-callback.js';
import * as ownerLogout from './functions/api/owner-logout.js';
import * as ownerMe from './functions/api/owner-me.js';
import * as ownerResetPasscode from './functions/api/owner-reset-passcode.js';
import * as ownerWipe from './functions/api/owner-wipe.js';
import * as ownerLog from './functions/api/owner-log.js';

const routes = [
  { pattern: '/api/admin-login', POST: adminLogin.onRequestPost },
  { pattern: '/api/admin-logout', GET: adminLogout.onRequestGet },
  { pattern: '/api/admin-me', GET: adminMe.onRequestGet },
  { pattern: '/api/member-login', POST: memberLogin.onRequestPost },
  { pattern: '/api/settings', GET: settings.onRequestGet, PUT: settings.onRequestPut },
  { pattern: '/api/competitions', GET: competitions.onRequestGet, POST: competitions.onRequestPost },
  { pattern: '/api/competition/:id', GET: competitionId.onRequestGet, PATCH: competitionId.onRequestPatch, DELETE: competitionId.onRequestDelete },
  { pattern: '/api/competition/:id/entries', GET: entries.onRequestGet, POST: entries.onRequestPost },
  { pattern: '/api/competition/:id/entry/:entryId', PATCH: entryId.onRequestPatch, DELETE: entryId.onRequestDelete },
  { pattern: '/api/entry-image/:key', GET: entryImage.onRequestGet },
  { pattern: '/api/owner-login', GET: ownerLogin.onRequestGet },
  { pattern: '/api/owner-callback', GET: ownerCallback.onRequestGet },
  { pattern: '/api/owner-logout', GET: ownerLogout.onRequestGet },
  { pattern: '/api/owner-me', GET: ownerMe.onRequestGet },
  { pattern: '/api/owner-reset-passcode', POST: ownerResetPasscode.onRequestPost },
  { pattern: '/api/owner-wipe', POST: ownerWipe.onRequestPost },
  { pattern: '/api/owner-log', GET: ownerLog.onRequestGet }
];

function matchPattern(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (part !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function matchRoute(pathname) {
  for (const route of routes) {
    const params = matchPattern(route.pattern, pathname);
    if (params) return { route, params };
  }
  return null;
}

// Belt-and-braces HTTPS enforcement. The zone's "Always Use HTTPS" setting
// (SSL/TLS -> Edge Certificates in the Cloudflare dashboard) is what should
// normally catch this before a request ever reaches the Worker, but that's
// a dashboard toggle, not something this repo controls — so redirect here
// too in case it's ever off, and set HSTS so browsers stop trying plain
// HTTP against this host on their own.
function enforceHttps(url) {
  if (url.protocol !== 'http:') return null;
  url.protocol = 'https:';
  return Response.redirect(url.toString(), 301);
}

const HSTS = 'max-age=63072000; includeSubDomains; preload';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const httpsRedirect = enforceHttps(url);
    if (httpsRedirect) return httpsRedirect;

    let response;
    if (url.pathname.startsWith('/api/')) {
      const matched = matchRoute(url.pathname);
      if (!matched) {
        response = new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      } else {
        const handler = matched.route[request.method];
        if (!handler) {
          response = new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
        } else {
          try {
            response = await handler({ request, env, params: matched.params, ctx });
          } catch (err) {
            console.error(err);
            response = new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    } else {
      response = await env.ASSETS.fetch(request);
    }

    response = new Response(response.body, response);
    response.headers.set('Strict-Transport-Security', HSTS);
    return response;
  }
};
