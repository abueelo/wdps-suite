import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OrderedEntry } from '../types.js';
import type { DocxOptions } from './docxBuilder.js';

const ENTRY_WIDTH = 14;
const THUMB_WIDTH = 28;
const PHOTOGRAPHER_WIDTH = 40;
const SCORE_WIDTH = 22;
const NOTES_WIDTH = 45;

function uint8ToDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

function buildDoc(entries: OrderedEntry[], opts: DocxOptions, variant: 'scorer' | 'judge'): jsPDF {
  const includePhotographer = variant === 'scorer';
  const includeNotes = variant === 'judge';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const title = variant === 'scorer' ? `${opts.competitionName} — Scorer Sheet` : `${opts.competitionName} — Judge Sheet`;
  doc.setFontSize(16);
  doc.text(title, 40, 40);

  const head = [variant === 'scorer' ? 'Entry #' : 'No.'];
  if (opts.includeThumbnails) head.push('Image');
  head.push('Image Title');
  if (includePhotographer) head.push('Photographer');
  head.push('Score');
  if (includeNotes) head.push('Notes');

  const thumbColIndex = head.indexOf('Image');

  const body = entries.map((entry) => {
    const row = [String(entry.entryNumber)];
    if (opts.includeThumbnails) row.push('');
    row.push(entry.image.title || '(untitled)');
    if (includePhotographer) row.push(entry.image.photographer);
    row.push('');
    if (includeNotes) row.push('');
    return row;
  });

  const columnStyles: Record<number, { cellWidth: number }> = {};
  let col = 0;
  columnStyles[col++] = { cellWidth: ENTRY_WIDTH };
  if (opts.includeThumbnails) columnStyles[col++] = { cellWidth: THUMB_WIDTH };
  col++; // title column stretches to fill remaining width — no fixed size
  if (includePhotographer) columnStyles[col++] = { cellWidth: PHOTOGRAPHER_WIDTH };
  columnStyles[col++] = { cellWidth: SCORE_WIDTH };
  if (includeNotes) columnStyles[col++] = { cellWidth: NOTES_WIDTH };

  autoTable(doc, {
    startY: 60,
    head: [head],
    body,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 6, minCellHeight: opts.includeThumbnails ? 40 : undefined },
    headStyles: { fillColor: [58, 58, 52], textColor: [255, 255, 255] },
    columnStyles,
    tableWidth: 'auto',
    didDrawCell: (data) => {
      if (
        opts.includeThumbnails &&
        data.column.index === thumbColIndex &&
        data.row.section === 'body'
      ) {
        const entry = entries[data.row.index];
        const bytes = opts.thumbnails.get(entry.image.id);
        if (bytes) {
          try {
            const dataUrl = uint8ToDataUrl(bytes);
            const pad = 3;
            doc.addImage(dataUrl, 'JPEG', data.cell.x + pad, data.cell.y + pad, data.cell.width - pad * 2, data.cell.height - pad * 2);
          } catch {
            // if a thumbnail fails to embed, leave the cell blank rather than break the whole export
          }
        }
      }
    }
  });

  return doc;
}

export async function buildScorerPdf(entries: OrderedEntry[], opts: DocxOptions): Promise<Uint8Array> {
  return new Uint8Array(buildDoc(entries, opts, 'scorer').output('arraybuffer'));
}

export async function buildJudgePdf(entries: OrderedEntry[], opts: DocxOptions): Promise<Uint8Array> {
  return new Uint8Array(buildDoc(entries, opts, 'judge').output('arraybuffer'));
}
