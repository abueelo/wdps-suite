// Same filename-humanizing approach as comp-sheets'
// apps/comp-sheets/src/lib/parsing/filenameParser.ts, minus the
// author/title split — this tool only ever guesses a title; the
// photographer name is typed once for the whole upload session, not
// derived from filenames.
const CAMERA_DEFAULT = /^(img|dsc|dscn|dcim|pxl|_mg|p|dji|mvimg)[-_]?\d+$/i;
const PURELY_NUMERIC = /^\d+$/;
const LEADING_NUMBER = /^(\d+)[_-]+(.+)$/;

function humanize(segment: string): string {
  return segment
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase boundary
    .trim()
    .replace(/\s+/g, ' ');
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Guesses a title from a filename — empty for camera-default names like IMG_1234 or plain numbers. */
export function guessTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  if (CAMERA_DEFAULT.test(withoutExt) || PURELY_NUMERIC.test(withoutExt) || withoutExt.trim() === '') {
    return '';
  }
  // drop a leading sequence number if present, e.g. "01_Sunset" -> "Sunset"
  const leadingNumber = LEADING_NUMBER.exec(withoutExt);
  const rest = leadingNumber ? leadingNumber[2] : withoutExt;
  return titleCase(humanize(rest));
}
