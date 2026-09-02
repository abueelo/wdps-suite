import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ImageRun,
  WidthType,
  HeadingLevel,
  TableLayoutType
} from 'docx';
import type { OrderedEntry } from '../types.js';

export interface DocxOptions {
  competitionName: string;
  includeThumbnails: boolean;
  thumbnails: Map<string, Uint8Array>; // imageId -> thumbnail JPEG bytes
}

const THUMB_DISPLAY_WIDTH = 90; // px in the doc
const THUMB_DISPLAY_HEIGHT = 60;

// Fixed percentage widths per column type; "Image Title" — the one
// column with genuinely variable-length content — absorbs whatever's
// left so every row always sums to exactly 100% of the page width. Cells
// need an explicit width or Word auto-fits columns to their header text
// instead of stretching the table to fill the page, which is what was
// making these look squished.
const ENTRY_WIDTH = 8;
const THUMB_WIDTH = 15;
const PHOTOGRAPHER_WIDTH = 22;
const SCORE_WIDTH = 12;
const NOTES_WIDTH = 25;

function cellWidth(percent: number) {
  return { size: percent, type: WidthType.PERCENTAGE };
}

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width: cellWidth(width),
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })]
  });
}

function textCell(text: string, width: number): TableCell {
  return new TableCell({ width: cellWidth(width), children: [new Paragraph(text)] });
}

function thumbnailCell(bytes: Uint8Array | undefined, width: number): TableCell {
  if (!bytes) return new TableCell({ width: cellWidth(width), children: [new Paragraph('')] });
  return new TableCell({
    width: cellWidth(width),
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

function blankCell(width: number): TableCell {
  // Blank, sized for handwriting a score/note in when the sheet is printed.
  return new TableCell({ children: [new Paragraph('')], width: cellWidth(width) });
}

function buildTable(entries: OrderedEntry[], opts: DocxOptions, variant: 'scorer' | 'judge'): Table {
  const includePhotographer = variant === 'scorer';
  const includeNotes = variant === 'judge';

  let titleWidth = 100 - ENTRY_WIDTH - SCORE_WIDTH;
  if (opts.includeThumbnails) titleWidth -= THUMB_WIDTH;
  if (includePhotographer) titleWidth -= PHOTOGRAPHER_WIDTH;
  if (includeNotes) titleWidth -= NOTES_WIDTH;

  const headerCells = [headerCell('Entry #', ENTRY_WIDTH)];
  if (opts.includeThumbnails) headerCells.push(headerCell('Thumbnail', THUMB_WIDTH));
  headerCells.push(headerCell('Image Title', titleWidth));
  if (includePhotographer) headerCells.push(headerCell('Photographer', PHOTOGRAPHER_WIDTH));
  headerCells.push(headerCell('Score', SCORE_WIDTH));
  if (includeNotes) headerCells.push(headerCell('Notes', NOTES_WIDTH));

  const headerRow = new TableRow({ children: headerCells, tableHeader: true });

  const rows = entries.map((entry) => {
    const cells: TableCell[] = [textCell(String(entry.entryNumber), ENTRY_WIDTH)];
    if (opts.includeThumbnails) cells.push(thumbnailCell(opts.thumbnails.get(entry.image.id), THUMB_WIDTH));
    cells.push(textCell(entry.image.title || '(untitled)', titleWidth));
    if (includePhotographer) cells.push(textCell(entry.image.photographer, PHOTOGRAPHER_WIDTH));
    cells.push(blankCell(SCORE_WIDTH));
    if (includeNotes) cells.push(blankCell(NOTES_WIDTH));
    return new TableRow({ children: cells });
  });

  return new Table({
    width: cellWidth(100),
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...rows]
  });
}

function buildDoc(entries: OrderedEntry[], opts: DocxOptions, variant: 'scorer' | 'judge'): Document {
  const title = variant === 'scorer' ? `${opts.competitionName} — Scorer Sheet` : `${opts.competitionName} — Judge Sheet`;
  return new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          buildTable(entries, opts, variant)
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
