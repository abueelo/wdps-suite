import type { Competition, Entry } from '../types.js';
import { fetchEntryBlob } from '../api/client.js';
import { entryFilename } from '../naming/entryFilename.js';
import { streamZip, type ZipFile } from './zipBuilder.js';
import { saveStreamedFile } from './download.js';

/** Downloads every non-excluded entry as one zip, named like comp-sheets' own exports. */
export async function downloadCompetitionZip(competition: Competition, entries: Entry[]): Promise<'saved' | 'cancelled'> {
  const included = entries.filter((e) => !e.excluded);
  const files: ZipFile[] = [];
  let n = 1;
  for (const entry of included) {
    if (!entry.originalUrl) continue;
    const blob = await fetchEntryBlob(entry.originalUrl);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    files.push({ filename: entryFilename(n++, entry.photographer, entry.title, entry.ext), bytes });
  }
  return saveStreamedFile(`${competition.name}.zip`, 'application/zip', (onChunk) => streamZip(files, onChunk));
}
