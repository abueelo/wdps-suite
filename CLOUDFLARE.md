# Cloudflare setup

One-time setup to get `wdps.russl.dev` live on Cloudflare, deploying through GitHub Actions on push to `main` — same approach as the portfolio site this suite's look is lifted from. This project is a plain Worker with static assets under Cloudflare's unified Workers & Pages model, not a classic Pages project (that's why `worker.js` exists as an explicit router and why the KV/R2 bindings below are declared directly in `wrangler.jsonc` rather than through a dashboard binding UI), so deploying it is a `wrangler deploy`, not a Pages-specific action.

## 1. Create the project

Deploys go through GitHub Actions (`.github/workflows/deploy.yml`) on push to `main` — don't use the dashboard's **Connect to Git**, that sets up a competing pipeline that'll fight the workflow over which deploy is current.

1. `npx wrangler login`, then from the repo root: `npm run build && npx wrangler deploy`. This both creates the Worker (named `wdps-suite`, from `wrangler.jsonc`) and deploys it for the first time — after this it exists under **Workers & Pages** in the dashboard even though nothing was clicked there.
2. Grab a Cloudflare API token (the "Edit Cloudflare Workers" template covers it) and your account id (right sidebar of the dashboard).
3. Add both as repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
4. Push to `main`, or just run the workflow manually, to confirm it deploys on its own from here on.

Node version for the build is pinned in the workflow itself (`actions/setup-node`, currently 20) — nothing to set in a Cloudflare build-settings screen, since Cloudflare isn't doing the building anymore.

## 2. Custom domain

1. In the Worker's dashboard page → **Settings** → **Domains & Routes** → **Add** → **Custom Domain**.
2. Enter `wdps.russl.dev`.
3. Since `russl.dev` is already on Cloudflare DNS, the CNAME and SSL cert should provision themselves within a minute or two — no manual DNS record needed.
4. `russl.dev` zone → **SSL/TLS** → **Edge Certificates** → confirm **Always Use HTTPS** is on. That's what redirects plain `http://wdps.russl.dev` at the edge; the Worker also does its own http→https redirect and sends an HSTS header as a fallback, but this toggle is the primary fix and it's a per-zone dashboard setting, not something in this repo.

## 3. Check the branch setup worked

- Push to `test` → nothing deploys (the workflow only triggers on `main`). Use `npm run build` + `npm run dev:*` locally, or `wrangler dev`, to check things before merging.
- Merge `test` into `main` → the Action runs and that becomes the live deployment at `wdps.russl.dev`. Check the **Actions** tab for the run rather than a Cloudflare deployments list.

That split is deliberate: `main` is production, so it only moves when a merge is actually approved, not on every commit.

## 4. upload-portal's backend

Every other app in the suite is a plain static build with nothing uploaded anywhere. upload-portal is the exception — it needs somewhere to put member-submitted images, so it has its own KV namespace and R2 bucket, separate from anything else on the account.

Unlike a classic Pages project, the bindings for these live in `wrangler.jsonc`, committed to the repo — not a dashboard step. So the setup is just creating the two resources with matching names/IDs:

1. **KV**: dashboard → **Storage & Databases** → **KV** → create a namespace. If you name it anything other than `wdps-upload-portal`, update the `id` under `kv_namespaces` in `wrangler.jsonc` to match (`npx wrangler kv namespace list` prints the id).
2. **R2**: dashboard → **R2** → create a bucket named `wdps-upload-portal-images` (or update `bucket_name` under `r2_buckets` in `wrangler.jsonc` to whatever you called it).
3. **Secrets**: runtime secrets, not the repo secrets from step 1 — those two (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`) only let GitHub Actions deploy the Worker, they're never visible to it at request time. These are different: dashboard → the Worker → **Settings** → **Variables and secrets**. Or skip the dashboard entirely: `npx wrangler secret put <NAME>` from a terminal logged in via `wrangler login`. Add these:
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
- If the Action's build step fails on an unrelated package script, check the Node version in `.github/workflows/deploy.yml` — the Svelte/Vite toolchain here wants 18.17+.
