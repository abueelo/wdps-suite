export interface Contestant {
  id: string;
  blob: Blob;
  filename: string;
  photographer?: string;
  title?: string;
  order: number;
  /** Set when this contestant came in as part of an upload-portal
   *  competition import, so that whole import can be pulled back out
   *  again without wiping the rest of the draw screen. */
  importBatch?: { id: string; label: string };
}

/**
 * One node of the bracket tree. `id` is deterministic (`r${round}m${slot}`)
 * rather than random — the bracket's shape *is* the identity, so a
 * computed id makes "which match does this winner feed into" a plain
 * lookup instead of something that needs a separate index to track.
 *
 * Round 1 is the first real round. `a`/`b` are null for a later round's
 * match until its two feeder matches (round-1 less, same slot doubled)
 * resolve. `bye` is only ever set on a round-1 match built with a single
 * contestant — it's auto-resolved the moment the bracket is drawn (see
 * lib/bracket/build.ts), so a later round never has a "genuine" bye of
 * its own; "not yet reachable" there is simply `a === null || b === null`.
 */
export interface Match {
  id: string;
  round: number;
  slot: number;
  a: string | null;
  b: string | null;
  winnerId: string | null;
  bye: boolean;
}

export interface SlideConfig {
  enabled: boolean;
  image?: Blob;
  /** Title slide only — ignored for the break slide. */
  heading?: string;
}

export type Scene = 'title' | 'break' | 'match' | 'bracket';

export interface LiveSession {
  contestants: Contestant[];
  /** Empty until the bracket has been drawn — see `drawn`. */
  matches: Match[];
  drawn: boolean;
  currentMatchId: string | null;
  scene: Scene;
  /** Independent toggles — title and photographer can be revealed separately. */
  revealTitle: boolean;
  revealPhotographer: boolean;
  /** When on, a revealed caption only shows for a few seconds after switching, instead of staying up. */
  revealFlashOnly: boolean;
  borderGuide: boolean;
  titleSlide: SlideConfig;
  breakSlide: SlideConfig;
}

export function emptySession(): LiveSession {
  return {
    contestants: [],
    matches: [],
    drawn: false,
    currentMatchId: null,
    scene: 'title',
    revealTitle: false,
    revealPhotographer: false,
    revealFlashOnly: false,
    borderGuide: false,
    titleSlide: { enabled: true, heading: 'wdps' },
    breakSlide: { enabled: false }
  };
}
