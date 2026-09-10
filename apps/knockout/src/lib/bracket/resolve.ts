import type { Match } from '../types.js';

export function getTotalRounds(matches: Match[]): number {
  return matches.reduce((max, m) => Math.max(max, m.round), 0);
}

/**
 * Sets a match's winner and propagates it into the correct slot of the
 * next round's match. Pure — returns a new array, never mutates `matches`.
 * A no-op (returns a shallow copy unchanged) if the match doesn't exist or
 * is already decided, so callers don't need to guard against re-deciding.
 */
export function recordWinner(matches: Match[], matchId: string, winnerId: string): Match[] {
  const next = matches.map((m) => ({ ...m }));
  const match = next.find((m) => m.id === matchId);
  if (!match || match.winnerId !== null) return next;
  if (winnerId !== match.a && winnerId !== match.b) {
    throw new Error('winner must be one of this match\'s two contestants');
  }
  match.winnerId = winnerId;

  const totalRounds = getTotalRounds(next);
  if (match.round < totalRounds) {
    const nextMatch = next.find((m) => m.round === match.round + 1 && m.slot === Math.floor(match.slot / 2));
    if (nextMatch) {
      if (match.slot % 2 === 0) nextMatch.a = winnerId;
      else nextMatch.b = winnerId;
    }
  }
  return next;
}

/** The champion's contestant id, or null until the final match is decided. */
export function getChampion(matches: Match[]): string | null {
  const totalRounds = getTotalRounds(matches);
  const final = matches.find((m) => m.round === totalRounds);
  return final?.winnerId ?? null;
}

/**
 * The next match that's both reachable (both slots filled) and undecided,
 * in round-then-slot order. No round-boundary special-casing is needed:
 * round r+1 slot i's two feeders are always round r slots 2i and 2i+1, so
 * the instant the last undecided match of round r resolves, every round
 * r+1 slot has necessarily already been filled by that same propagation —
 * this plain scan just finds it on the very next call.
 */
export function firstReachableUndecidedMatch(matches: Match[]): Match | null {
  const sorted = [...matches].sort((a, b) => a.round - b.round || a.slot - b.slot);
  return sorted.find((m) => m.winnerId === null && m.a !== null && m.b !== null) ?? null;
}
