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
  TableLayoutType,
  PageOrientation
} from 'docx';
import type { OrderedEntry } from '../types.js';

export interface ThumbnailData {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface DocxOptions {
  competitionName: string;
  includeThumbnails: boolean;
  thumbnails: Map<string, ThumbnailData>; // imageId -> thumbnail JPEG + its dimensions
}

const DEFAULT_FONT = 'Calibri';
const THUMB_DISPLAY_WIDTH = 90; // px in the doc
const THUMB_DISPLAY_HEIGHT = 60;
// Extra blank lines in the Notes cell so there's real room to write on a
// printed sheet, rather than one cramped line.
const NOTES_BLANK_LINES = 3;

// A4 portrait, in twips (1/1440in) — spelled out explicitly rather than
// left to the library's default so the width math below has a fixed page
// to work from.
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 720; // 0.5in — Word's "Narrow" preset, so the table uses more of the page
const USABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// Fixed percentage widths per column type, per variant — the club's own
// preferred layout (arrived at by hand-adjusting a generated sheet in
// Word). "Image Title" absorbs whatever's left so every row always sums
// to exactly 100% of the page width; cells need an explicit width or
// Word auto-fits columns to their header text instead of stretching the
// table to fill the page.
const SCORER_WIDTHS = { entry: 6, thumb: 15, photographer: 22, score: 8 };
const JUDGE_WIDTHS = { entry: 6, thumb: 15, score: 8, notes: 50 };

// Percentages are turned into absolute twips (DXA) against USABLE_WIDTH
// rather than passed through docx's own WidthType.PERCENTAGE. That type
// gets written out as e.g. `w:w="6%"` — Word accepts the percent-sign
// form, but macOS Preview and Pages don't, and silently collapse every
// column to (near) zero width, squashing the whole table into the top
// left corner of the page.
function cellWidth(percent: number) {
  return { size: Math.round((USABLE_WIDTH * percent) / 100), type: WidthType.DXA };
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

// Scales width/height down to fit inside the THUMB_DISPLAY box while
// keeping the image's own aspect ratio, so portrait and landscape shots
// both sit un-stretched in the cell (just letterboxed within it).
function containDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(THUMB_DISPLAY_WIDTH / width, THUMB_DISPLAY_HEIGHT / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function thumbnailCell(thumb: ThumbnailData | undefined, width: number): TableCell {
  if (!thumb) return new TableCell({ width: cellWidth(width), children: [new Paragraph('')] });
  return new TableCell({
    width: cellWidth(width),
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'jpg',
            data: thumb.bytes,
            transformation: containDimensions(thumb.width, thumb.height)
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
  const entryLabel = 'No.';

  let titleWidth = 100 - widths.entry - widths.score;
  if (opts.includeThumbnails) titleWidth -= widths.thumb;
  if (includePhotographer) titleWidth -= (widths as typeof SCORER_WIDTHS).photographer;
  if (includeNotes) titleWidth -= (widths as typeof JUDGE_WIDTHS).notes;

  // Column percentages in cell order — also used below to fill in the
  // table's grid, which is what determines column widths under a fixed
  // layout. The per-cell widths set via cellWidth() are a fallback Word
  // is happy to ignore in favour of the grid, but Preview and Pages take
  // them literally, so without a matching grid they render every column
  // at the tiny placeholder width docx defaults the grid to.
  const colPercents = [widths.entry];
  if (opts.includeThumbnails) colPercents.push(widths.thumb);
  colPercents.push(titleWidth);
  if (includePhotographer) colPercents.push((widths as typeof SCORER_WIDTHS).photographer);
  colPercents.push(widths.score);
  if (includeNotes) colPercents.push((widths as typeof JUDGE_WIDTHS).notes);

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
    columnWidths: colPercents.map((percent) => cellWidth(percent).size),
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...rows]
  });
}

// Direct formatting (not a referenced "Heading 1" style, whose look
// depends on the docx library's built-in style pack and isn't
// predictable) so the title always renders exactly this way: 16pt bold
// Calibri, with a blank line before the table.
const HEADING_SIZE = 32; // half-points = 16pt

function buildDoc(entries: OrderedEntry[], opts: DocxOptions, variant: 'scorer' | 'judge'): Document {
  const title = variant === 'scorer' ? `${opts.competitionName} — Scorer Sheet` : `${opts.competitionName} — Judge Sheet`;
  const headingRun = { font: DEFAULT_FONT, bold: true, size: HEADING_SIZE };
  return new Document({
    styles: {
      default: {
        document: { run: { font: DEFAULT_FONT } }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT, orientation: PageOrientation.PORTRAIT },
            margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN }
          }
        },
        children: [
          new Paragraph({ children: [new TextRun({ text: title, ...headingRun })] }),
          new Paragraph({ children: [new TextRun({ text: '', font: DEFAULT_FONT, size: HEADING_SIZE })] }),
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
