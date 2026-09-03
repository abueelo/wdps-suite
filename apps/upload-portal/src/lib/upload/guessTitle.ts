// Ported from comp-sheets' apps/comp-sheets/src/lib/parsing/filenameParser.ts
// — same word-splitting approach, since club members already name their
// files NN_Author_Title for that tool. The difference: comp-sheets has to
// guess at an unknown batch of authors; here the photographer is already
// known (typed once for the whole session), so it's used to recognise
// and strip their name instead of assuming a name is embedded at all.
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

function titleFromRest(rest: string, knownPhotographer: string): string {
  const known = knownPhotographer.trim().toLowerCase();
  const topFields = rest.split(/[_-]+/).filter(Boolean);

  if (topFields.length === 2) {
    const [namePart, titlePart] = topFields;
    // only treat the first field as a name if it actually matches the
    // known photographer — otherwise a genuine two-word title (e.g.
    // "Stunning_Sunset") would lose its first word for nothing.
    if (known && humanize(namePart).toLowerCase() === known) {
      return titleCase(humanize(titlePart));
    }
    return titleCase(humanize(rest));
  }

  const words = splitWords(rest);
  if (words.length < 2) return titleCase(words.join(' '));

  if (known) {
    for (let len = Math.min(words.length - 1, 3); len >= 1; len--) {
      if (words.slice(0, len).join(' ').toLowerCase() === known) {
        return titleCase(words.slice(len).join(' '));
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
