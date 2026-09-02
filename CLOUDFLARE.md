# Cloudflare setup

One-time setup to get `wdps.russl.dev` live on Cloudflare Pages, deploying automatically from GitHub.

## 1. Create the Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the `abueelo/wdps-suite` repo, authorising Cloudflare's GitHub app if it asks.
3. Build settings:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Add an environment variable `NODE_VERSION` = `20` (Cloudflare's default build image runs an older Node than this needs).
5. Save and deploy. First build takes a couple of minutes.

## 2. Custom domain

1. In the new Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `wdps.russl.dev`.
3. Since `russl.dev` is already on Cloudflare DNS, the CNAME and SSL cert should provision themselves within a minute or two — no manual DNS record needed.

## 3. Check the branch setup worked

- Push to `test` → Pages should spin up a preview deployment at a `*.pages.dev` URL, separate from the live site.
- Merge `test` into `main` → Pages deploys that to `wdps.russl.dev` directly.

That split is deliberate: `main` is production, so it only moves when a merge is actually approved, not on every commit.

## notes

- No KV, R2, or Workers Functions needed — this is a plain static build, everything runs client-side in the visitor's browser.
- If a build fails on an unrelated package script, check the `NODE_VERSION` env var landed — Cloudflare's build image defaults to something older than the Svelte/Vite toolchain wants.
