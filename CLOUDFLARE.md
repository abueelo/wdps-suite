# Cloudflare setup

One-time setup to get `wdps.russl.dev` live on Cloudflare Pages, deploying automatically from GitHub.

## 1. Create the project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the `abueelo/wdps-suite` repo, authorising Cloudflare's GitHub app if it asks.
3. Build settings:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy` — important, this is not what Cloudflare defaults to. This project ends up as a plain Worker with static assets under Cloudflare's unified Workers & Pages model, not a classic Pages project, and a couple of the classic Pages behaviours (Pages Functions' automatic `functions/` routing, the dashboard's binding UI) just don't apply to it — that's why `worker.js` exists as an explicit router and why the KV/R2 bindings are declared directly in `wrangler.jsonc` rather than through the dashboard. If the build settings ever default to `npx wrangler versions upload` or `npx wrangler pages deploy` instead, fix it back to plain `wrangler deploy` in Settings → Builds.
4. Add an environment variable `NODE_VERSION` = `20` (Cloudflare's default build image runs an older Node than this needs).
5. Save and deploy. First build takes a couple of minutes.

## 2. Custom domain

1. In the new Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `wdps.russl.dev`.
3. Since `russl.dev` is already on Cloudflare DNS, the CNAME and SSL cert should provision themselves within a minute or two — no manual DNS record needed.

## 3. Check the branch setup worked

- Push to `test` → a build runs and shows up under the project's **Deployments** tab as a new "version" (not tagged production) — check there rather than expecting a `*.pages.dev` preview URL, which is a classic-Pages-only thing that doesn't apply here.
- Merge `test` into `main` → that becomes the active deployment at `wdps.russl.dev`.

That split is deliberate: `main` is production, so it only moves when a merge is actually approved, not on every commit.

## 4. upload-portal's backend

Every other app in the suite is a plain static build with nothing uploaded anywhere. upload-portal is the exception — it needs somewhere to put member-submitted images, so it has its own KV namespace and R2 bucket, separate from anything else on the account.

Unlike a classic Pages project, the bindings for these live in `wrangler.jsonc`, committed to the repo — not a dashboard step. So the setup is just creating the two resources with matching names/IDs:

1. **KV**: dashboard → **Storage & Databases** → **KV** → create a namespace. If you name it anything other than `wdps-upload-portal`, update the `id` under `kv_namespaces` in `wrangler.jsonc` to match (`npx wrangler kv namespace list` prints the id).
2. **R2**: dashboard → **R2** → create a bucket named `wdps-upload-portal-images` (or update `bucket_name` under `r2_buckets` in `wrangler.jsonc` to whatever you called it).
3. **Secrets**: dashboard → the project → **Settings** → **Variables and secrets** (or `npx wrangler secret put <NAME>` from a terminal logged in via `wrangler login`), add these as secrets:
   - `SESSION_SECRET` — any long random string (`openssl rand -hex 32`)
   - `ADMIN_PASSCODE` — the passcode whoever's running the competition uses to get into `/upload-portal/admin.html`
   - `MEMBER_PASSCODE` — not enforced yet (the member gate defaults off, flip it on from the admin settings panel once this is set)
4. Push (or redeploy) — bindings apply on the next `wrangler deploy`, no separate step needed.

For local dev: `cp .dev.vars.example .dev.vars`, fill it in, then run the Worker locally with `npx wrangler dev` (build first with `npm run build`) — this uses the real `kv_namespaces`/`r2_buckets` from `wrangler.jsonc` against Cloudflare's dev-mode remote storage, not a local emulation, so be mindful it can touch real data unless you point it at separate dev resources.

## 5. Owner console

`/upload-portal/owner.html` — reachable by clicking "abueelo" at the bottom of any page — is GitHub-gated on top of the admin passcode, same idea as this portfolio site's own `/edit`. It can reset the admin/member passcodes without a redeploy, wipe the portal's storage, and show a log of uploads/logins.

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**. Homepage `https://wdps.russl.dev`, callback `https://wdps.russl.dev/api/owner-callback`. Generate a client secret.
2. Add two more secrets, same place as step 4.3 above: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
3. That's it — no separate "who's the owner" setting, it's hardcoded to `abueelo` in `functions/_lib.js`.

For local dev, a second OAuth App pointed at `http://localhost:8787` / `http://localhost:8787/api/owner-callback` (`wrangler dev`'s default port) works the same way portfolio's dev app does — add those to `.dev.vars` instead.

## notes

- Every app except upload-portal is a plain static build — everything else in the suite runs client-side in the visitor's browser, nothing uploaded anywhere.
- If a build fails on an unrelated package script, check the `NODE_VERSION` env var landed — Cloudflare's build image defaults to something older than the Svelte/Vite toolchain wants.
