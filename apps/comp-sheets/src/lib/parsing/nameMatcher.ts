/** Small hand-rolled Levenshtein distance — not worth a dependency. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[\s._-]+/g, '');
}

/**
 * Finds an existing confirmed photographer name that's a likely spelling
 * variant of `candidate` (e.g. "JohnSmith" vs "John Smith" vs "J Smith"),
 * so the UI can suggest consolidating instead of silently creating a
 * near-duplicate photographer — which would fragment their images across
 * multiple identities and break both filename numbering and fairness caps.
 */
export function findLikelyMatch(candidate: string, existingNames: string[], threshold = 2): string | null {
  const normCandidate = normalize(candidate);
  if (!normCandidate) return null;

  for (const existing of existingNames) {
    const normExisting = normalize(existing);
    if (normExisting === normCandidate) return existing;
    if (levenshtein(normCandidate, normExisting) <= threshold) return existing;
  }
  return null;
}
