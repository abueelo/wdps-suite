// Guesses a title from a filename, the way comp-sheets guesses at author
// and title (apps/comp-sheets/src/lib/parsing/filenameParser.ts) — same
// word-splitting, since club members already name files that way for
// that tool. The difference: comp-sheets has to guess at an unknown
// batch of authors; here the photographer is already known (typed once
// for the session), so instead of assuming their name sits at some
// particular position in the filename, this searches the whole thing
// for a run of words matching their name — wherever it actually is —
// and strips just that.
const CAMERA_DEFAULT = /^(img|dsc|dscn|dcim|pxl|_mg|p|dji|mvimg)[-_]?\d+$/i;
const PURELY_NUMERIC = /^\d+$/;
const LEADING_NUMBER = /^(\d+)[_-]+(.+)$/;

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

function titleFromRest(rest: string, knownPhotographer: string): string {
  const words = splitWords(rest);
  const knownWords = splitWords(knownPhotographer).map((w) => w.toLowerCase());

  if (knownWords.length > 0 && knownWords.length < words.length) {
    const target = knownWords.join(' ');
    for (let start = 0; start <= words.length - knownWords.length; start++) {
      const slice = words.slice(start, start + knownWords.length).map((w) => w.toLowerCase());
      if (slice.join(' ') === target) {
        const remaining = [...words.slice(0, start), ...words.slice(start + knownWords.length)];
        return titleCase(remaining.join(' '));
      }
    }
  }

  return titleCase(words.join(' '));
}

/** Guesses a title from a filename, stripping the known photographer's name if it's embedded in it. */
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
