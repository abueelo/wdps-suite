// Builds every app in the suite and assembles them into one dist/ tree:
//   dist/                <- hub, at the domain root
//   dist/comp-sheets/    <- comp-sheets app
//
// This lets the whole suite deploy as a single Cloudflare Pages project
// under one custom domain, with each app living at its own sub-path.

import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distRoot = path.join(root, 'dist');

const apps = [
  { name: 'hub', dir: 'apps/hub', outSubdir: '' },
  { name: 'comp-sheets', dir: 'apps/comp-sheets', outSubdir: 'comp-sheets' },
  { name: 'upload-portal', dir: 'apps/upload-portal', outSubdir: 'upload-portal' },
  { name: 'presenter', dir: 'apps/presenter', outSubdir: 'presenter' }
];

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });

for (const app of apps) {
  const appDir = path.join(root, app.dir);
  console.log(`\nbuilding ${app.name}...`);
  execSync('npm run build', { cwd: appDir, stdio: 'inherit' });

  const appDist = path.join(appDir, 'dist');
  if (!existsSync(appDist)) {
    throw new Error(`${app.name} build did not produce a dist/ directory`);
  }

  const target = app.outSubdir ? path.join(distRoot, app.outSubdir) : distRoot;
  mkdirSync(target, { recursive: true });
  cpSync(appDist, target, { recursive: true });
}

console.log('\nsuite build complete -> dist/');
