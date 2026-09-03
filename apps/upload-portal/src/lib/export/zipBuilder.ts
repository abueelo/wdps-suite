import { Zip, ZipDeflate } from 'fflate';

export interface ZipFile {
  filename: string;
  bytes: Uint8Array;
}

/**
 * Streams a flat zip archive, flushing compressed entries incrementally
 * via `onChunk` rather than building one giant in-memory archive object —
 * same fflate streaming pattern as comp-sheets'
 * apps/comp-sheets/src/lib/export/zipBuilder.ts.
 */
export function streamZip(files: ZipFile[], onChunk: (chunk: Uint8Array) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (chunk) onChunk(chunk);
      if (final) resolve();
    });

    for (const file of files) {
      const entry = new ZipDeflate(file.filename, { level: 6 });
      zip.add(entry);
      entry.push(file.bytes, true);
    }

    zip.end();
  });
}
