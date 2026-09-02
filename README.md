# wdps

Tools for the club's digital competitions, hosted at wdps.russl.dev.

## apps

- `apps/comp-sheets` — uploads competition entries, renames/resizes them to the required format, and generates judge/scorer score sheets.
- `apps/hub` — landing page linking out to the apps in the suite.

## packages

- `packages/shared-ui` — the shared terminal-style design system (ported from russl.dev).
- `packages/shared-bus` — lets apps in the suite hand off processed images to each other via IndexedDB.

Everything runs client-side — no backend, nothing is ever uploaded anywhere.

## development

Requires Node 18.17+.

```
npm install
npm run dev:hub          # hub dev server
npm run dev:comp-sheets  # comp-sheets dev server
npm run build             # builds everything into dist/
```

## deployment

Cloudflare Pages, connected to the `main` branch. Build command `npm run build`, output directory `dist`. Custom domain `wdps.russl.dev`.
