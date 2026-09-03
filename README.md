# wdps

Tools for the club's digital competitions, at [wdps.russl.dev](https://wdps.russl.dev).

![hub](docs/screenshots/hub.jpg)

comp-sheets runs entirely in the browser — upload photos, it renames and resizes them to whatever format the competition needs, and spits out a zip with correctly named images plus judge and scorer score sheets. Nothing gets uploaded anywhere for that one; it's all done client-side with canvas and web workers.

## apps

- **comp-sheets** — upload a batch of entries, fix up any names it guessed wrong, set a fair per-photographer limit, and export. Judge gets an anonymised set with no photographer names, scorer gets the full thing.
- **upload-portal** — lets members submit their own competition entries (title, name, image) instead of the organiser collecting them by hand. Admin reviews what came in, grouped by photographer, and can lock a competition, download it as a zip, or hand it straight off to comp-sheets.

More apps can live in here later — see `packages/shared-bus` below.

![review step](docs/screenshots/review.jpg)
![settings step](docs/screenshots/settings.jpg)

## how it's put together

An npm workspaces monorepo:

- `apps/hub` — the landing page above, plain TS, no framework
- `apps/comp-sheets` — the actual tool, Svelte 5 + TypeScript
- `apps/upload-portal` — the entry-submission tool, Svelte 5 + TypeScript, member and admin views built from the same app
- `packages/shared-ui` — the terminal look (colours, fonts, buttons, the ascii banners) shared across apps, lifted straight from my [portfolio site](https://russl.dev)
- `packages/shared-bus` — lets apps in the suite hand images off to each other through IndexedDB, so a second app could pick up where comp-sheets left off — this is how upload-portal hands a locked competition's entries to comp-sheets
- `functions/` — Cloudflare Pages Functions backing upload-portal (competitions/entries API, KV + R2 storage). Everything else in the suite is a plain static build; this is the one app with a server side to it

## running it locally

Needs Node 18.17+.

```
npm install
npm run dev:hub            # hub on its own dev server
npm run dev:comp-sheets    # comp-sheets on its own dev server
npm run dev:upload-portal  # upload-portal on its own dev server (frontend only, no API)
npm run build               # builds everything into dist/
```

`npm run build` is what actually matters for testing the real thing — it assembles all three apps into one `dist/` tree the way they'll be served in production (hub at the root, the others under their own `/comp-sheets/` / `/upload-portal/` sub-paths), so serve that instead of relying on the separate dev servers if you want to check routing between them.

upload-portal's dev server alone doesn't have its API — that needs Cloudflare's local Functions runtime against real KV/R2 bindings, see [CLOUDFLARE.md](CLOUDFLARE.md).

## deploying

Cloudflare Pages, connected to GitHub. Full steps in [CLOUDFLARE.md](CLOUDFLARE.md).

Work happens on the `test` branch; `main` only gets merges when they're actually ready to go live, since that's what Pages deploys to production from.
