// Same NN_Photographer_Title convention comp-sheets exports with
// (apps/comp-sheets/src/lib/naming/renamer.ts), so a zip download or a
// comp-sheets hand-off reads consistently with everything else in the suite.

function sanitizeForFilename(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
}

export function entryFilename(entryNumber: number, photographer: string, title: string, ext: string): string {
  const nn = String(entryNumber).padStart(2, '0');
  const safePhotographer = sanitizeForFilename(photographer) || 'Unknown';
  const safeTitle = sanitizeForFilename(title) || 'Untitled';
  return `${nn}_${safePhotographer}_${safeTitle}.${ext}`;
}
