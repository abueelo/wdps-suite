# wdps

Tools for the club's digital competitions, at [wdps.russl.dev](https://wdps.russl.dev).

![hub](docs/screenshots/hub.jpg)

Everything runs in the browser — upload photos, it renames and resizes them to whatever format the competition needs, and spits out a zip with correctly named images plus judge and scorer score sheets. Nothing gets uploaded anywhere; it's all done client-side with canvas and web workers.

## apps

- **comp-sheets** — upload a batch of entries, fix up any names it guessed wrong, set a fair per-photographer limit, and export. Judge gets an anonymised set with no photographer names, scorer gets the full thing.

More apps can live in here later — see `packages/shared-bus` below.

![review step](docs/screenshots/review.jpg)
![settings step](docs/screenshots/settings.jpg)

## how it's put together

An npm workspaces monorepo:

- `apps/hub` — the landing page above, plain TS, no framework
- `apps/comp-sheets` — the actual tool, Svelte 5 + TypeScript
- `packages/shared-ui` — the terminal look (colours, fonts, buttons, the ascii banners) shared across apps, lifted straight from my [portfolio site](https://russl.dev)
- `packages/shared-bus` — lets apps in the suite hand images off to each other through IndexedDB, so a second app could pick up where comp-sheets left off

## running it locally

Needs Node 18.17+.

```
npm install
npm run dev:hub          # hub on its own dev server
npm run dev:comp-sheets  # comp-sheets on its own dev server
npm run build             # builds everything into dist/
```

`npm run build` is what actually matters for testing the real thing — it assembles the hub and comp-sheets into one `dist/` tree the way they'll be served in production (hub at the root, comp-sheets under `/comp-sheets/`), so serve that instead of relying on the separate dev servers if you want to check routing between them.

## deploying

Cloudflare Pages, connected to GitHub. Full steps in [CLOUDFLARE.md](CLOUDFLARE.md).

Work happens on the `test` branch; `main` only gets merges when they're actually ready to go live, since that's what Pages deploys to production from.
