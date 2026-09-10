// Save/re-import a whole session as a single .zip "project file" — the
// images, ratings, held flags, scene, and title/break slide config
// (including any uploaded slide image). This is what lets a session
// survive being closed and reopened later, or be archived/handed to
// someone else, on top of the IndexedDB autosave that already covers a
// same-browser refresh.

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { LiveSession, PresenterImage, Scene } from '../types.js';
import { emptySession } from '../types.js';

const MANIFEST_VERSION = 1;

interface ManifestImage {
  id: string;
  filename: string;
  contentType: string;
  photographer?: string;
  title?: string;
  rating: number | null;
  held: boolean;
  order: number;
  file: string;
}

interface ManifestSlide {
  enabled: boolean;
  heading?: string;
  contentType?: string;
  file?: string;
}

interface ProjectManifest {
  version: number;
  scene: Scene;
  currentImageId: string | null;
  revealTitle: boolean;
  revealPhotographer: boolean;
  revealFlashOnly: boolean;
  borderGuide: boolean;
  titleSlide: ManifestSlide;
  breakSlide: ManifestSlide;
  images: ManifestImage[];
}

export async function exportProjectFile(session: LiveSession): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};

  const images: ManifestImage[] = [];
  for (const img of session.images) {
    const path = `images/${img.id}__${img.filename}`;
    files[path] = new Uint8Array(await img.blob.arrayBuffer());
    images.push({
      id: img.id,
      filename: img.filename,
      contentType: img.blob.type,
      photographer: img.photographer,
      title: img.title,
      rating: img.rating,
      held: img.held,
      order: img.order,
      file: path
    });
  }

  async function slideManifest(slide: LiveSession['titleSlide'], path: string): Promise<ManifestSlide> {
    if (!slide.image) return { enabled: slide.enabled, heading: slide.heading };
    files[path] = new Uint8Array(await slide.image.arrayBuffer());
    return { enabled: slide.enabled, heading: slide.heading, contentType: slide.image.type, file: path };
  }

  const manifest: ProjectManifest = {
    version: MANIFEST_VERSION,
    scene: session.scene,
    currentImageId: session.currentImageId,
    revealTitle: session.revealTitle,
    revealPhotographer: session.revealPhotographer,
    revealFlashOnly: session.revealFlashOnly,
    borderGuide: session.borderGuide,
    titleSlide: await slideManifest(session.titleSlide, 'slides/title'),
    breakSlide: await slideManifest(session.breakSlide, 'slides/break'),
    images
  };

  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
}

export async function importProjectFile(file: Blob): Promise<LiveSession> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) throw new Error('not a presenter project file — no manifest.json inside');

  const manifest: ProjectManifest = JSON.parse(strFromU8(manifestBytes));

  const images: PresenterImage[] = manifest.images.map((m) => ({
    id: m.id,
    blob: new Blob([entries[m.file]], { type: m.contentType }),
    filename: m.filename,
    photographer: m.photographer,
    title: m.title,
    rating: m.rating,
    held: m.held,
    order: m.order
  }));

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
    images,
    scene: manifest.scene,
    currentImageId: manifest.currentImageId,
    revealTitle: manifest.revealTitle,
    revealPhotographer: manifest.revealPhotographer,
    revealFlashOnly: manifest.revealFlashOnly,
    borderGuide: manifest.borderGuide,
    titleSlide: readSlide(manifest.titleSlide),
    breakSlide: readSlide(manifest.breakSlide)
  };
}
