import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, ImageRun, WidthType, HeadingLevel } from 'docx';
import type { OrderedEntry } from '../types.js';

export interface DocxOptions {
  competitionName: string;
  includeThumbnails: boolean;
  thumbnails: Map<string, Uint8Array>; // imageId -> thumbnail JPEG bytes
}

const THUMB_DISPLAY_WIDTH = 90; // px in the doc
const THUMB_DISPLAY_HEIGHT = 60;

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
  });
}

function textCell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph(text)] });
}

function thumbnailCell(bytes: Uint8Array | undefined): TableCell {
  if (!bytes) return new TableCell({ children: [new Paragraph('')] });
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'jpg',
            data: bytes,
            transformation: { width: THUMB_DISPLAY_WIDTH, height: THUMB_DISPLAY_HEIGHT }
          })
        ]
      })
    ]
  });
}

function scoreCell(): TableCell {
  // Blank, sized for handwriting a score in when the sheet is printed.
  return new TableCell({ children: [new Paragraph('')], width: { size: 12, type: WidthType.PERCENTAGE } });
}

function buildTable(entries: OrderedEntry[], opts: DocxOptions, includePhotographer: boolean): Table {
  const headers = ['Entry #'];
  if (opts.includeThumbnails) headers.push('Thumbnail');
  headers.push('Image Title');
  if (includePhotographer) headers.push('Photographer');
  headers.push('Score');

  const headerRow = new TableRow({ children: headers.map(headerCell) });

  const rows = entries.map((entry) => {
    const cells: TableCell[] = [textCell(String(entry.entryNumber))];
    if (opts.includeThumbnails) cells.push(thumbnailCell(opts.thumbnails.get(entry.image.id)));
    cells.push(textCell(entry.image.title || '(untitled)'));
    if (includePhotographer) cells.push(textCell(entry.image.photographer));
    cells.push(scoreCell());
    return new TableRow({ children: cells });
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] });
}

function buildDoc(entries: OrderedEntry[], opts: DocxOptions, variant: 'scorer' | 'judge'): Document {
  const title = variant === 'scorer' ? `${opts.competitionName} — Scorer Sheet` : `${opts.competitionName} — Judge Sheet`;
  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          buildTable(entries, opts, variant === 'scorer')
        ]
      }
    ]
  });
}

export async function buildScorerDoc(entries: OrderedEntry[], opts: DocxOptions): Promise<Blob> {
  return Packer.toBlob(buildDoc(entries, opts, 'scorer'));
}

export async function buildJudgeDoc(entries: OrderedEntry[], opts: DocxOptions): Promise<Blob> {
  return Packer.toBlob(buildDoc(entries, opts, 'judge'));
}
