import type { CapError, CapResult } from '../types.js';

export interface PhotographerCount {
  photographer: string;
  submittedCount: number;
}

/**
 * Tiered fairness cap for the competition entry limit.
 *
 * Rule: raise every photographer's per-image cap tier by tier (1, 2, 3, ...),
 * but only apply a tier increase if EVERY photographer eligible for that
 * tier (i.e. who submitted at least that many images) can be included
 * without the running total exceeding the limit. Otherwise everyone stays
 * at the previous tier — it's all-or-nothing per tier, never a partial
 * promotion of some photographers within a tier.
 *
 * This is equivalent to finding the largest t such that
 *   total(t) = sum over photographers of min(t, submittedCount)  <=  limit
 * because total(t) is monotonically non-decreasing in t (raising the cap
 * never reduces anyone's count), so once a tier fails, no higher tier can
 * work either.
 */
export function computeCaps(
  photographers: PhotographerCount[],
  limit: number
): CapResult | CapError {
  const n = photographers.length;
  if (n === 0) {
    return { caps: {}, tier: 0, totalSelected: 0, fullySatisfied: true };
  }

  const total = (t: number): number =>
    photographers.reduce((sum, p) => sum + Math.min(t, p.submittedCount), 0);

  // At t=1, total(1) === n (everyone who submitted at least 1 contributes 1).
  if (total(1) > limit) {
    return { error: true, photographerCount: n, limit };
  }

  const maxSubmitted = Math.max(...photographers.map((p) => p.submittedCount));

  let bestT = 1;
  for (let t = 2; t <= maxSubmitted; t++) {
    if (total(t) <= limit) {
      bestT = t;
    } else {
      break; // total() is non-decreasing -> no higher t can work either
    }
  }

  const caps: Record<string, number> = {};
  for (const p of photographers) {
    caps[p.photographer] = Math.min(bestT, p.submittedCount);
  }

  return {
    caps,
    tier: bestT,
    totalSelected: total(bestT),
    fullySatisfied: bestT >= maxSubmitted
  };
}

export function isCapError(result: CapResult | CapError): result is CapError {
  return 'error' in result && result.error === true;
}
