import { Zip, ZipDeflate } from 'fflate';
import type { OrderedEntry, ProcessedImage } from '../types.js';

export interface ZipInputs {
  entries: OrderedEntry[];
  processed: Map<string, ProcessedImage>;
  scorerDocBytes: Uint8Array;
  judgeDocBytes: Uint8Array;
  scorerPdfBytes: Uint8Array;
  judgePdfBytes: Uint8Array;
  competitionName: string;
}

/**
 * Streams a zip archive with judge/ and scorer/ top-level folders,
 * flushing compressed entries incrementally via `onChunk` rather than
 * building one giant in-memory archive object. Each image's encoded
 * bytes are referenced into both folders without re-encoding.
 */
export function streamExportZip(inputs: ZipInputs, onChunk: (chunk: Uint8Array) => void): Promise<void> {
  const { entries, processed, scorerDocBytes, judgeDocBytes, scorerPdfBytes, judgePdfBytes, competitionName } = inputs;

  return new Promise((resolve, reject) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err);
        return;
      }
      if (chunk) onChunk(chunk);
      if (final) resolve();
    });

    for (const entry of entries) {
      const image = processed.get(entry.image.id);
      if (!image) continue; // failed during processing — skipped, not silently included

      const scorerFile = new ZipDeflate(`scorer/${entry.scorerFilename}`, { level: 6 });
      zip.add(scorerFile);
      scorerFile.push(image.bytes, true);

      const judgeFile = new ZipDeflate(`judge/${entry.judgeFilename}`, { level: 6 });
      zip.add(judgeFile);
      judgeFile.push(image.bytes, true);
    }

    const scorerDoc = new ZipDeflate(`scorer/${competitionName}-scorer-sheet.docx`, { level: 6 });
    zip.add(scorerDoc);
    scorerDoc.push(scorerDocBytes, true);

    const judgeDoc = new ZipDeflate(`judge/${competitionName}-judge-sheet.docx`, { level: 6 });
    zip.add(judgeDoc);
    judgeDoc.push(judgeDocBytes, true);

    const scorerPdf = new ZipDeflate(`scorer/${competitionName}-scorer-sheet.pdf`, { level: 6 });
    zip.add(scorerPdf);
    scorerPdf.push(scorerPdfBytes, true);

    const judgePdf = new ZipDeflate(`judge/${competitionName}-judge-sheet.pdf`, { level: 6 });
    zip.add(judgePdf);
    judgePdf.push(judgePdfBytes, true);

    zip.end();
  });
}
