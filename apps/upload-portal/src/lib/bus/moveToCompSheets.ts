import { putPayload, RAW_ENTRY_SET_TYPE, type BusItem } from '@wdps/shared-bus';
import type { Competition, Entry } from '../types.js';
import { fetchEntryBlob } from '../api/client.js';
import { entryFilename } from '../naming/entryFilename.js';

/**
 * Hands a locked competition's entries to comp-sheets via the suite's
 * cross-app bus (packages/shared-bus) — fetches each entry's original
 * bytes, then drops them on the bus with photographer/title carried as
 * structured `meta` (not just baked into the filename) so comp-sheets'
 * UploadStep imports them straight in at confidence 'ok', no re-typing.
 */
export async function moveToCompSheets(competition: Competition, entries: Entry[]): Promise<number> {
  const included = entries.filter((e) => !e.excluded && e.originalUrl);
  const items: BusItem[] = [];
  let n = 1;
  for (const entry of included) {
    const blob = await fetchEntryBlob(entry.originalUrl!);
    items.push({
      filename: entryFilename(n++, entry.photographer, entry.title, entry.ext),
      blob,
      contentType: entry.contentType,
      meta: { photographer: entry.photographer, title: entry.title }
    });
  }

  await putPayload({
    sourceApp: 'upload-portal',
    type: RAW_ENTRY_SET_TYPE,
    label: `${competition.name} — ${items.length} entries`,
    items,
    meta: { competitionId: competition.id, competitionName: competition.name }
  });

  return items.length;
}
