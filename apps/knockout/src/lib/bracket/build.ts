import type { Match } from '../types.js';
import { recordWinner } from './resolve.js';

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** Fisher-Yates — unbiased, in place on a copy. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function matchId(round: number, slot: number): string {
  return `r${round}m${slot}`;
}

/**
 * Builds a full single-elimination bracket from a random draw. `bracketSize`
 * is the smallest power of two at least as large as the contestant count;
 * the shortfall (`byeCount`) becomes first-round byes.
 *
 * Byes never collide (two byes forced into the same match, leaving no real
 * contestant in it): because `bracketSize` is the *smallest* such power of
 * two, whenever n isn't already a power of two, bracketSize/2 < n <=
 * bracketSize, so byeCount = bracketSize - n < bracketSize/2 — strictly
 * fewer byes than round-1 matches, so there's always a free match for each
 * one. (If n is already a power of two, byeCount is just 0.)
 *
 * Every later round is pre-built as an empty skeleton (both slots null) so
 * a bracket-tree display can render "TBD" placeholders for the whole
 * shape immediately, and every bye is resolved through the same
 * `recordWinner` path a real decision uses, so it propagates forward
 * exactly the same way.
 */
export function buildBracket(contestantIds: string[]): Match[] {
  const n = contestantIds.length;
  if (n < 2) throw new Error('need at least 2 contestants to draw a bracket');

  const bracketSize = nextPowerOfTwo(n);
  const byeCount = bracketSize - n;
  const round1Count = bracketSize / 2;

  const shuffledContestants = shuffle(contestantIds);
  const byeMatchIndices = new Set(shuffle([...Array(round1Count).keys()]).slice(0, byeCount));

  const matches: Match[] = [];
  let cursor = 0;
  for (let slot = 0; slot < round1Count; slot++) {
    if (byeMatchIndices.has(slot)) {
      matches.push({ id: matchId(1, slot), round: 1, slot, a: shuffledContestants[cursor++], b: null, winnerId: null, bye: true });
    } else {
      const a = shuffledContestants[cursor++];
      const b = shuffledContestants[cursor++];
      matches.push({ id: matchId(1, slot), round: 1, slot, a, b, winnerId: null, bye: false });
    }
  }

  const totalRounds = Math.log2(bracketSize);
  for (let round = 2; round <= totalRounds; round++) {
    const count = bracketSize / 2 ** round;
    for (let slot = 0; slot < count; slot++) {
      matches.push({ id: matchId(round, slot), round, slot, a: null, b: null, winnerId: null, bye: false });
    }
  }

  let resolved = matches;
  for (const m of matches.filter((m) => m.bye)) {
    resolved = recordWinner(resolved, m.id, m.a!);
  }
  return resolved;
}
