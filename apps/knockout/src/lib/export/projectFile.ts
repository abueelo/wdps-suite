// Save/re-import a whole session as a single .zip "project file" — the
// contestants, the drawn bracket, the scene, and title/break slide config
// (including any uploaded slide image). This is what lets a session
// survive being closed and reopened later, or be archived/handed to
// someone else, on top of the IndexedDB autosave that already covers a
// same-browser refresh.

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Contestant, LiveSession, Match, Scene } from '../types.js';
import { emptySession } from '../types.js';

const MANIFEST_VERSION = 1;

interface ManifestContestant {
  id: string;
  filename: string;
  contentType: string;
  photographer?: string;
  title?: string;
  order: number;
  file: string;
  // Persisted (unlike presenter's own project file, which currently drops
  // this) — the draw screen keeps import batches individually removable,
  // so a resumed project needs this intact to keep working.
  importBatch?: { id: string; label: string };
}

interface ManifestMatch {
  id: string;
  round: number;
  slot: number;
  a: string | null;
  b: string | null;
  winnerId: string | null;
  bye: boolean;
}

interface ManifestSlide {
  enabled: boolean;
  heading?: string;
  contentType?: string;
  file?: string;
}

interface ProjectManifest {
  version: number;
  drawn: boolean;
  currentMatchId: string | null;
  scene: Scene;
  revealTitle: boolean;
  revealPhotographer: boolean;
  revealFlashOnly: boolean;
  borderGuide: boolean;
  titleSlide: ManifestSlide;
  breakSlide: ManifestSlide;
  contestants: ManifestContestant[];
  matches: ManifestMatch[];
}

export async function exportProjectFile(session: LiveSession): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};

  const contestants: ManifestContestant[] = [];
  for (const c of session.contestants) {
    const path = `contestants/${c.id}__${c.filename}`;
    files[path] = new Uint8Array(await c.blob.arrayBuffer());
    contestants.push({
      id: c.id,
      filename: c.filename,
      contentType: c.blob.type,
      photographer: c.photographer,
      title: c.title,
      order: c.order,
      file: path,
      importBatch: c.importBatch
    });
  }

  const matches: ManifestMatch[] = session.matches.map((m) => ({ ...m }));

  async function slideManifest(slide: LiveSession['titleSlide'], path: string): Promise<ManifestSlide> {
    if (!slide.image) return { enabled: slide.enabled, heading: slide.heading };
    files[path] = new Uint8Array(await slide.image.arrayBuffer());
    return { enabled: slide.enabled, heading: slide.heading, contentType: slide.image.type, file: path };
  }

  const manifest: ProjectManifest = {
    version: MANIFEST_VERSION,
    drawn: session.drawn,
    currentMatchId: session.currentMatchId,
    scene: session.scene,
    revealTitle: session.revealTitle,
    revealPhotographer: session.revealPhotographer,
    revealFlashOnly: session.revealFlashOnly,
    borderGuide: session.borderGuide,
    titleSlide: await slideManifest(session.titleSlide, 'slides/title'),
    breakSlide: await slideManifest(session.breakSlide, 'slides/break'),
    contestants,
    matches
  };

  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
}

export async function importProjectFile(file: Blob): Promise<LiveSession> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) throw new Error('not a knockout project file — no manifest.json inside');

  const manifest: ProjectManifest = JSON.parse(strFromU8(manifestBytes));

  const contestants: Contestant[] = manifest.contestants.map((m) => ({
    id: m.id,
    blob: new Blob([entries[m.file]], { type: m.contentType }),
    filename: m.filename,
    photographer: m.photographer,
    title: m.title,
    order: m.order,
    importBatch: m.importBatch
  }));

  const matches: Match[] = manifest.matches.map((m) => ({ ...m }));

  function readSlide(m: ManifestSlide): LiveSession['titleSlide'] {
    return {
      enabled: m.enabled,
      heading: m.heading,
      image: m.file && entries[m.file] ? new Blob([entries[m.file]], { type: m.contentType }) : undefined
    };
  }

  const base = emptySession();
  return {
    ...base,
    contestants,
    matches,
    drawn: manifest.drawn,
    currentMatchId: manifest.currentMatchId,
    scene: manifest.scene,
    revealTitle: manifest.revealTitle,
    revealPhotographer: manifest.revealPhotographer,
    revealFlashOnly: manifest.revealFlashOnly,
    borderGuide: manifest.borderGuide,
    titleSlide: readSlide(manifest.titleSlide),
    breakSlide: readSlide(manifest.breakSlide)
  };
}
