import type { ImageRecord, OrderedEntry } from '../types.js';
import { assignFilenames } from '../naming/renamer.js';

/** mulberry32 — tiny seeded PRNG so a shuffle is reproducible/debuggable. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYates<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface OrderOptions {
  randomize: boolean;
  /** Seed for the shuffle, so "reshuffle" is a deliberate, reproducible action. */
  seed?: number;
}

/**
 * Produces the final competition order for the included images.
 *
 * - randomize=false: grouped by photographer (in the order photographers
 *   were first confirmed), then by each photographer's priority order —
 *   the same order the fairness-cap preview already shows.
 * - randomize=true: a full Fisher–Yates shuffle of the included set.
 *
 * Both judge and scorer exports must consume the SAME OrderedEntry[] so
 * their entry numbers and filenames line up exactly — only the presence
 * of the photographer name in the docx differs between the two.
 */
export function buildCompetitionOrder(included: ImageRecord[], options: OrderOptions): OrderedEntry[] {
  const filenames = assignFilenames(included);

  let ordered: ImageRecord[];
  if (options.randomize) {
    const rng = mulberry32(options.seed ?? Date.now());
    ordered = fisherYates(included, rng);
  } else {
    // Group by first-appearance order of photographer, then priority within.
    const firstSeen = new Map<string, number>();
    included.forEach((img, i) => {
      if (!firstSeen.has(img.photographer)) firstSeen.set(img.photographer, i);
    });
    ordered = [...included].sort((a, b) => {
      const byPhotographer = firstSeen.get(a.photographer)! - firstSeen.get(b.photographer)!;
      if (byPhotographer !== 0) return byPhotographer;
      return a.priority - b.priority;
    });
  }

  return ordered.map((image, index) => ({
    entryNumber: index + 1,
    image,
    filename: filenames.get(image.id)!
  }));
}
