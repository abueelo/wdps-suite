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

## 4. upload-portal's backend

Every other app in the suite is a plain static build with nothing uploaded anywhere. upload-portal is the exception — it needs somewhere to put member-submitted images, so it has its own KV namespace and R2 bucket, separate from anything else on the account.

1. **KV**: dashboard → **Storage & Databases** → **KV** → create a namespace (e.g. `wdps-upload-portal`). In the Pages project → **Settings** → **Functions** → **KV namespace bindings**, add one bound as `COMPETITIONS_KV`.
2. **R2**: dashboard → **R2** → create a bucket (e.g. `wdps-upload-portal-images`). Same Functions settings page → **R2 bucket bindings**, bind it as `ENTRY_IMAGES`.
3. **Secrets**: still in Functions settings → **Environment variables**, add these as encrypted/secret production vars:
   - `SESSION_SECRET` — any long random string (`openssl rand -hex 32`)
   - `ADMIN_PASSCODE` — the passcode whoever's running the competition uses to get into `/upload-portal/admin.html`
   - `MEMBER_PASSCODE` — not enforced yet (the member gate defaults off, flip it on from the admin settings panel once this is set)
4. Redeploy (or just push) after adding bindings — they only take effect on the next build.

For local dev: `cp .dev.vars.example .dev.vars`, fill it in, then run Functions against local KV/R2 with `npx wrangler pages dev dist --kv COMPETITIONS_KV --r2 ENTRY_IMAGES` (build first with `npm run build`).

## notes

- Every app except upload-portal is a plain static build — everything else in the suite runs client-side in the visitor's browser, nothing uploaded anywhere.
- If a build fails on an unrelated package script, check the `NODE_VERSION` env var landed — Cloudflare's build image defaults to something older than the Svelte/Vite toolchain wants.
