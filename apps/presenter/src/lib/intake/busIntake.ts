// Pulling in a comp-sheets handoff via packages/shared-bus. comp-sheets'
// scorer export doesn't attach per-item `meta` (see its ExportStep), so
// photographer/title come from a best-effort filename guess, same as a
// local folder load — the filename itself is always shown as a fallback.

import { listPayloads, IMAGE_SET_TYPE, type BusPayload } from '@wdps/shared-bus';
import type { PresenterImage } from '../types.js';
import { guessMetaFromFilename } from './filenameMeta.js';

export async function listCompSheetsPayloads(): Promise<BusPayload[]> {
  const payloads = await listPayloads(IMAGE_SET_TYPE);
  return payloads.filter((p) => p.sourceApp === 'comp-sheets');
}

export function buildImagesFromPayload(payload: BusPayload, startOrder: number): PresenterImage[] {
  return payload.items.map((item, i) => {
    const metaPhotographer = typeof item.meta?.photographer === 'string' ? item.meta.photographer : undefined;
    const metaTitle = typeof item.meta?.title === 'string' ? item.meta.title : undefined;
    const guessed = metaPhotographer && metaTitle ? {} : guessMetaFromFilename(item.filename);
    return {
      id: crypto.randomUUID(),
      blob: item.blob,
      filename: item.filename,
      photographer: metaPhotographer ?? guessed.photographer,
      title: metaTitle ?? guessed.title,
      rating: null,
      held: false,
      order: startOrder + i
    };
  });
}
