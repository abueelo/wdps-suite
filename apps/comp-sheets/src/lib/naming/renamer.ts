import type { ImageRecord } from '../types.js';

function sanitizeForFilename(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
}

export interface EntryFilenames {
  scorerFilename: string;
  judgeFilename: string;
}

/**
 * Builds the two filenames for one competition entry:
 *   scorer: NN_Photographer_Title.jpg
 *   judge:  NN_Title.jpg — no photographer name, so the judge can't see
 *           who took it just by looking at the file list.
 *
 * NN is the competition entry number (same one shown in the docx Entry #
 * column), not a per-photographer counter, so a judge/scorer can always
 * match a file straight back to its row on the sheet — including when
 * randomise-order is on.
 */
export function buildFilenames(entryNumber: number, image: ImageRecord): EntryFilenames {
  const nn = String(entryNumber).padStart(2, '0');
  const safePhotographer = sanitizeForFilename(image.photographer) || 'Unknown';
  const safeTitle = sanitizeForFilename(image.title) || 'Untitled';
  return {
    scorerFilename: `${nn}_${safePhotographer}_${safeTitle}.jpg`,
    judgeFilename: `${nn}_${safeTitle}.jpg`
  };
}
