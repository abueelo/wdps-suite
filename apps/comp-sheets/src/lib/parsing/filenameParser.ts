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

export function parseFilename(originalName: string): ParsedName {
  const withoutExt = originalName.replace(/\.[^.]+$/, '');

  if (CAMERA_DEFAULT.test(withoutExt) || PURELY_NUMERIC.test(withoutExt) || withoutExt.trim() === '') {
    return { photographer: '', title: '', confidence: 'low' };
  }

  const rawParts = withoutExt.split(/[_-]+/).filter(Boolean);

  // No delimiter at all — just one blob (possibly camelCase). Not enough
  // structure to confidently split a name out of a title.
  if (rawParts.length <= 1) {
    const humanized = titleCase(humanize(withoutExt));
    return {
      photographer: '',
      title: humanized,
      confidence: isNameLikeToken(withoutExt) ? 'medium' : 'low'
    };
  }

  // Exactly two delimited parts is the common "Name_Title" convention —
  // the strongest, most unambiguous signal we get from a filename alone.
  if (rawParts.length === 2) {
    const [namePart, titlePart] = rawParts;
    const photographer = titleCase(humanize(namePart));
    const title = titleCase(humanize(titlePart));
    const confidence: Confidence = isNameLikeToken(namePart) && isNameLikeToken(titlePart) ? 'high' : 'medium';
    return { photographer, title, confidence };
  }

  // Three or more parts: assume the first token is the name and
  // everything else is the title. This is a default, not a certainty —
  // a title that itself starts with a two-word name would fool it — so
  // it's capped at medium confidence for the user to confirm.
  const [namePart, ...titleParts] = rawParts;
  const photographer = titleCase(humanize(namePart));
  const title = titleCase(humanize(titleParts.join(' ')));
  return { photographer, title, confidence: isNameLikeToken(namePart) ? 'medium' : 'low' };
}
