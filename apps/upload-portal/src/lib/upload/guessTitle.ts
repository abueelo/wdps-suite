// Faithful port of comp-sheets' guessAuthorTitle
// (apps/comp-sheets/src/lib/parsing/filenameParser.ts) — same positional
// pattern: the name is whatever leading word(s) the Author_Title
// convention puts there, not a string search for a known name anywhere
// in the filename. The only difference from comp-sheets: there's just
// one known name here (typed once for the session) instead of a growing
// set built from an unknown batch, and only the title half is kept.
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

/** Splits a blob into individual words, however they're joined: underscores, hyphens, spaces, or camelCase. */
function splitWords(segment: string): string[] {
  return segment
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .flatMap((piece) => piece.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean));
}

/**
 * Splits "author + title" text into the two fields, same as comp-sheets:
 * exactly two top-level fields is unambiguous (first is the name). More
 * than two falls back to a word-count guess — 2 leading words as the
 * name normally, refined to whatever length actually matches the known
 * photographer when that's found among the leading words.
 */
function titleFromRest(rest: string, photographer: string): string {
  const known = photographer.trim().toLowerCase();
  const topFields = rest.split(/[_-]+/).filter(Boolean);

  if (topFields.length === 2) {
    const [, titlePart] = topFields;
    return titleCase(humanize(titlePart));
  }

  const words = splitWords(rest);
  if (words.length < 2) return titleCase(words.join(' '));

  let authorWordCount = words.length >= 3 ? 2 : 1;
  if (known) {
    for (let len = Math.min(words.length - 1, 3); len >= 1; len--) {
      if (words.slice(0, len).join(' ').toLowerCase() === known) {
        authorWordCount = len;
        break;
      }
    }
  }

  return titleCase(words.slice(authorWordCount).join(' '));
}

/** Guesses a title from a filename, following the same Author_Title pattern comp-sheets does. */
export function guessTitle(filename: string, photographer: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  if (CAMERA_DEFAULT.test(withoutExt) || PURELY_NUMERIC.test(withoutExt) || withoutExt.trim() === '') {
    return '';
  }
  // drop a leading sequence number if present, e.g. "01_Sunset" -> "Sunset"
  const leadingNumber = LEADING_NUMBER.exec(withoutExt);
  const rest = leadingNumber ? leadingNumber[2] : withoutExt;
  return titleFromRest(rest, photographer);
}
