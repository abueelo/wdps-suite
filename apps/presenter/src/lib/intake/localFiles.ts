import type { PresenterImage } from '../types.js';
import { guessMetaFromFilename } from './filenameMeta.js';

export function buildImagesFromFiles(files: File[], startOrder: number): PresenterImage[] {
  return files.map((file, i) => {
    const meta = guessMetaFromFilename(file.name);
    return {
      id: crypto.randomUUID(),
      blob: file,
      filename: file.name,
      photographer: meta.photographer,
      title: meta.title,
      rating: null,
      held: false,
      order: startOrder + i
    };
  });
}
