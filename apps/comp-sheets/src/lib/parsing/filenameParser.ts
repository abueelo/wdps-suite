import type { Confidence } from '../types.js';

export interface ParsedName {
  photographer: string;
  title: string;
  confidence: Confidence;
}

// Camera/scanner default filenames carry no identity information at all —
// never attempt a guess for these, straight to manual entry.
const CAMERA_DEFAULT = /^(img|dsc|dscn|dcim|pxl|_mg|p|dji|mvimg)[-_]?\d+$/i;
const PURELY_NUMERIC = /^\d+$/;

// Expected convention: NN_Author_Title (a leading sequence number, preferably
// two digits, then the author, then the title, separated by underscores).
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

/** A chunk that plausibly looks like words in a name/title (letters and spaces, no digits). */
function isNameLikeToken(token: string): boolean {
  const trimmed = token.trim();
  return /^[A-Za-z][A-Za-z .'-]*$/.test(trimmed) && !/\d/.test(trimmed);
}

/** Splits a blob into individual words, however they're joined: underscores, hyphens, spaces, or camelCase. */
function splitWords(segment: string): string[] {
  return segment
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .flatMap((piece) => piece.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean));
}

interface AuthorTitleGuess {
  photographer: string;
  title: string;
  /** True only when the author/title boundary was unambiguous (exactly two top-level fields). */
  clean: boolean;
}

/**
 * Splits "author + title" text (everything after the sequence number) into
 * the two fields. When there's exactly one underscore left, the split is
 * unambiguous. Otherwise — because photographer names and titles are both
 * sometimes written with underscores between their own words, and a name
 * can be one word or several — this checks the leading words against
 * `knownAuthors` (names already seen unambiguously elsewhere in the same
 * batch) before falling back to a plain two-word guess.
 */
function guessAuthorTitle(rest: string, knownAuthors: ReadonlySet<string>): AuthorTitleGuess {
  const topFields = rest.split(/[_-]+/).filter(Boolean);

  if (topFields.length === 2) {
    const [namePart, titlePart] = topFields;
    return {
      photographer: titleCase(humanize(namePart)),
      title: titleCase(humanize(titlePart)),
      clean: isNameLikeToken(namePart)
    };
  }

  const words = splitWords(rest);
  if (words.length < 2) {
    return { photographer: '', title: titleCase(words.join(' ')), clean: false };
  }

  let authorWordCount = words.length >= 3 ? 2 : 1;
  for (let len = Math.min(words.length - 1, 3); len >= 1; len--) {
    if (knownAuthors.has(words.slice(0, len).join(' ').toLowerCase())) {
      authorWordCount = len;
      break;
    }
  }

  return {
    photographer: titleCase(words.slice(0, authorWordCount).join(' ')),
    title: titleCase(words.slice(authorWordCount).join(' ')),
    clean: false
  };
}

export function parseFilename(originalName: string, knownAuthors: ReadonlySet<string> = new Set()): ParsedName {
  const withoutExt = originalName.replace(/\.[^.]+$/, '');

  if (CAMERA_DEFAULT.test(withoutExt) || PURELY_NUMERIC.test(withoutExt) || withoutExt.trim() === '') {
    return { photographer: '', title: '', confidence: 'attention' };
  }

  const leadingNumber = LEADING_NUMBER.exec(withoutExt);

  // No sequence number prefix at all — doesn't match the expected
  // NN_Author_Title convention, so flag it regardless of what we can
  // still guess from the remaining structure.
  if (!leadingNumber) {
    const guess = guessAuthorTitle(withoutExt, knownAuthors);
    return { photographer: guess.photographer, title: guess.title, confidence: 'attention' };
  }

  const [, numberStr, rest] = leadingNumber;
  const guess = guessAuthorTitle(rest, knownAuthors);
  const correctlyFormatted = numberStr.length === 2 && guess.clean;

  return { photographer: guess.photographer, title: guess.title, confidence: correctlyFormatted ? 'ok' : 'attention' };
}
