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

const DEFAULT_FONT = 'Calibri';
const THUMB_DISPLAY_WIDTH = 90; // px in the doc
const THUMB_DISPLAY_HEIGHT = 60;
// Extra blank lines in the Notes cell so there's real room to write on a
// printed sheet, rather than one cramped line.
const NOTES_BLANK_LINES = 3;

// Fixed percentage widths per column type, per variant — the club's own
// preferred layout (arrived at by hand-adjusting a generated sheet in
// Word). "Image Title" absorbs whatever's left so every row always sums
// to exactly 100% of the page width; cells need an explicit width or
// Word auto-fits columns to their header text instead of stretching the
// table to fill the page.
const SCORER_WIDTHS = { entry: 6, thumb: 15, photographer: 22, score: 8 };
const JUDGE_WIDTHS = { entry: 6, thumb: 15, score: 8, notes: 50 };

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

function blankCell(width: number, lines = 1): TableCell {
  // Blank, sized for handwriting a score/note in when the sheet is printed.
  return new TableCell({
    width: cellWidth(width),
    children: Array.from({ length: lines }, () => new Paragraph(''))
  });
}

function buildTable(entries: OrderedEntry[], opts: DocxOptions, variant: 'scorer' | 'judge'): Table {
  const includePhotographer = variant === 'scorer';
  const includeNotes = variant === 'judge';
  const widths = variant === 'scorer' ? SCORER_WIDTHS : JUDGE_WIDTHS;
  const entryLabel = variant === 'scorer' ? 'Entry #' : 'No.';

  let titleWidth = 100 - widths.entry - widths.score;
  if (opts.includeThumbnails) titleWidth -= widths.thumb;
  if (includePhotographer) titleWidth -= (widths as typeof SCORER_WIDTHS).photographer;
  if (includeNotes) titleWidth -= (widths as typeof JUDGE_WIDTHS).notes;

  const headerCells = [headerCell(entryLabel, widths.entry)];
  if (opts.includeThumbnails) headerCells.push(headerCell('Thumbnail', widths.thumb));
  headerCells.push(headerCell('Image Title', titleWidth));
  if (includePhotographer) headerCells.push(headerCell('Photographer', (widths as typeof SCORER_WIDTHS).photographer));
  headerCells.push(headerCell('Score', widths.score));
  if (includeNotes) headerCells.push(headerCell('Notes', (widths as typeof JUDGE_WIDTHS).notes));

  const headerRow = new TableRow({ children: headerCells, tableHeader: true });

  const rows = entries.map((entry) => {
    const cells: TableCell[] = [textCell(String(entry.entryNumber), widths.entry)];
    if (opts.includeThumbnails) cells.push(thumbnailCell(opts.thumbnails.get(entry.image.id), widths.thumb));
    cells.push(textCell(entry.image.title || '(untitled)', titleWidth));
    if (includePhotographer) cells.push(textCell(entry.image.photographer, (widths as typeof SCORER_WIDTHS).photographer));
    cells.push(blankCell(widths.score));
    if (includeNotes) cells.push(blankCell((widths as typeof JUDGE_WIDTHS).notes, NOTES_BLANK_LINES));
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
    styles: {
      default: {
        document: { run: { font: DEFAULT_FONT } }
      }
    },
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
