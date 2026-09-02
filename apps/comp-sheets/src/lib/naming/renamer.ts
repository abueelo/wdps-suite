import type { ImageRecord } from '../types.js';

function sanitizeForFilename(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
}

/**
 * Assigns each included image its final filename, per-photographer:
 * NN_PHOTOGRAPHER_NAME.jpg, where NN starts at 01 and increases per
 * photographer in their priority order. This numbering is independent of
 * (and unaffected by) the competition entry order/randomization.
 */
export function assignFilenames(images: ImageRecord[]): Map<string, string> {
  const byPhotographer = new Map<string, ImageRecord[]>();
  for (const img of images) {
    const list = byPhotographer.get(img.photographer) ?? [];
    list.push(img);
    byPhotographer.set(img.photographer, list);
  }

  const filenames = new Map<string, string>();
  for (const [photographer, list] of byPhotographer) {
    const sorted = [...list].sort((a, b) => a.priority - b.priority);
    const safeName = sanitizeForFilename(photographer);
    sorted.forEach((img, index) => {
      const nn = String(index + 1).padStart(2, '0');
      filenames.set(img.id, `${nn}_${safeName}.jpg`);
    });
  }

  return filenames;
}
