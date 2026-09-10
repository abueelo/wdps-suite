// Results score sheet — same page/table layout approach as comp-sheets'
// own docxBuilder.ts (fixed-width columns in twips, since Word ignores
// percentage widths from macOS Preview/Pages otherwise), except the
// Score column here is already filled in from the live ratings rather
// than left blank for a judge to write on.

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
import type { PresenterImage } from '../types.js';
import type { Thumbnail } from '../processing/thumbnail.js';

export interface ResultsDocOptions {
  competitionName: string;
  includeThumbnails: boolean;
  thumbnails: Map<string, Thumbnail>; // imageId -> thumbnail
}

const DEFAULT_FONT = 'Calibri';
const THUMB_DISPLAY_WIDTH = 90;
const THUMB_DISPLAY_HEIGHT = 60;

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 720;
const USABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const WIDTHS = { entry: 6, thumb: 15, photographer: 22, score: 8, held: 8 };

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

function containDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(THUMB_DISPLAY_WIDTH / width, THUMB_DISPLAY_HEIGHT / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function thumbnailCell(thumb: Thumbnail | undefined, width: number): TableCell {
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

function buildTable(images: PresenterImage[], opts: ResultsDocOptions): Table {
  let titleWidth = 100 - WIDTHS.entry - WIDTHS.photographer - WIDTHS.score - WIDTHS.held;
  if (opts.includeThumbnails) titleWidth -= WIDTHS.thumb;

  const colPercents = [WIDTHS.entry];
  if (opts.includeThumbnails) colPercents.push(WIDTHS.thumb);
  colPercents.push(titleWidth, WIDTHS.photographer, WIDTHS.score, WIDTHS.held);

  const headerCells = [headerCell('No.', WIDTHS.entry)];
  if (opts.includeThumbnails) headerCells.push(headerCell('Thumbnail', WIDTHS.thumb));
  headerCells.push(
    headerCell('Title', titleWidth),
    headerCell('Photographer', WIDTHS.photographer),
    headerCell('Score', WIDTHS.score),
    headerCell('Held', WIDTHS.held)
  );
  const headerRow = new TableRow({ children: headerCells, tableHeader: true });

  const sorted = [...images].sort((a, b) => a.order - b.order);
  const rows = sorted.map((image, i) => {
    const cells: TableCell[] = [textCell(String(i + 1), WIDTHS.entry)];
    if (opts.includeThumbnails) cells.push(thumbnailCell(opts.thumbnails.get(image.id), WIDTHS.thumb));
    cells.push(
      textCell(image.title || '(untitled)', titleWidth),
      textCell(image.photographer || '', WIDTHS.photographer),
      textCell(image.rating === null ? '—' : String(image.rating), WIDTHS.score),
      textCell(image.held ? 'yes' : '', WIDTHS.held)
    );
    return new TableRow({ children: cells });
  });

  return new Table({
    width: cellWidth(100),
    columnWidths: colPercents.map((percent) => cellWidth(percent).size),
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...rows]
  });
}

const HEADING_SIZE = 32;

export async function buildResultsDoc(images: PresenterImage[], opts: ResultsDocOptions): Promise<Blob> {
  const headingRun = { font: DEFAULT_FONT, bold: true, size: HEADING_SIZE };
  const doc = new Document({
    styles: {
      default: { document: { run: { font: DEFAULT_FONT } } }
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
          new Paragraph({ children: [new TextRun({ text: `${opts.competitionName} — Results`, ...headingRun })] }),
          new Paragraph({ children: [new TextRun({ text: '', font: DEFAULT_FONT, size: HEADING_SIZE })] }),
          buildTable(images, opts)
        ]
      }
    ]
  });
  return Packer.toBlob(doc);
}
