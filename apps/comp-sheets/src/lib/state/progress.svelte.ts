import type { ProcessingStage } from '../types.js';

type ImageProgressState = { stage: ProcessingStage | 'pending' | 'error'; error?: string };
type ZipStage = 'idle' | 'building' | 'done';

const STAGES: ProcessingStage[] = ['decode', 'resize', 'encode', 'dpi', 'thumbnail', 'done'];

function stageFraction(stage: ImageProgressState['stage']): number {
  if (stage === 'pending') return 0;
  if (stage === 'error') return 1; // counted as "done" for progress purposes, surfaced separately as an error
  const idx = STAGES.indexOf(stage as ProcessingStage);
  return idx === -1 ? 0 : (idx + 1) / STAGES.length;
}

let perImage = $state<Map<string, ImageProgressState>>(new Map());
let zipStage = $state<ZipStage>('idle');

export const progressStore = {
  get perImage(): Map<string, ImageProgressState> {
    return perImage;
  },
  get zipStage(): ZipStage {
    return zipStage;
  },
  reset(ids: string[]): void {
    const map = new Map<string, ImageProgressState>();
    for (const id of ids) map.set(id, { stage: 'pending' });
    perImage = map;
    zipStage = 'idle';
  },
  setStage(id: string, stage: ProcessingStage): void {
    const map = new Map(perImage);
    map.set(id, { stage });
    perImage = map;
  },
  setError(id: string, error: string): void {
    const map = new Map(perImage);
    map.set(id, { stage: 'error', error });
    perImage = map;
  },
  setZipStage(stage: ZipStage): void {
    zipStage = stage;
  },
  get overallFraction(): number {
    if (perImage.size === 0) return 0;
    let sum = 0;
    for (const p of perImage.values()) sum += stageFraction(p.stage);
    const imagesFraction = sum / perImage.size;
    // The last 10% of the bar is reserved for zip assembly, which is
    // comparatively quick but shouldn't look like nothing is happening.
    const zipFraction = zipStage === 'done' ? 1 : zipStage === 'building' ? 0.5 : 0;
    return imagesFraction * 0.9 + zipFraction * 0.1;
  }
};
