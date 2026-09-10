import type { Contestant } from '../types.js';
import { guessMetaFromFilename } from './filenameMeta.js';

export function buildContestantsFromFiles(files: File[], startOrder: number): Contestant[] {
  return files.map((file, i) => {
    const meta = guessMetaFromFilename(file.name);
    return {
      id: crypto.randomUUID(),
      blob: file,
      filename: file.name,
      photographer: meta.photographer,
      title: meta.title,
      order: startOrder + i
    };
  });
}
