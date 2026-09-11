// Pulls a competition straight from upload-portal's own API — knockout
// sits behind the same GitHub owner login as upload-portal's admin
// console (see ../auth/ownerAuth.ts), sharing the one owner_session
// cookie across the domain, so by the time this screen is reachable
// you're already authenticated for these endpoints too.

import type { Contestant } from '../types.js';

export interface UploadPortalCompetition {
  id: string;
  name: string;
  status: 'open' | 'locked';
  entryCount: number;
}

interface UploadPortalEntry {
  photographer: string;
  title: string;
  originalFilename: string;
  excluded: boolean;
  originalUrl?: string;
}

export async function listUploadPortalCompetitions(): Promise<UploadPortalCompetition[]> {
  const res = await fetch('/api/competitions', { credentials: 'include' });
  if (!res.ok) throw new Error(`could not reach upload-portal (${res.status})`);
  return res.json();
}

export async function importUploadPortalCompetition(competitionId: string, startOrder: number): Promise<Contestant[]> {
  const res = await fetch(`/api/competition/${competitionId}/entries`, { credentials: 'include' });
  if (!res.ok) throw new Error(`could not load that competition (${res.status})`);
  const { competition, entries } = (await res.json()) as {
    competition: { name: string };
    entries: UploadPortalEntry[];
  };
  const importBatch = { id: competitionId, label: competition.name };

  const contestants: Contestant[] = [];
  let i = 0;
  for (const entry of entries) {
    if (entry.excluded || !entry.originalUrl) continue;
    const imgRes = await fetch(entry.originalUrl, { credentials: 'include' });
    if (!imgRes.ok) throw new Error(`could not fetch ${entry.originalFilename}`);
    contestants.push({
      id: crypto.randomUUID(),
      blob: await imgRes.blob(),
      filename: entry.originalFilename,
      photographer: entry.photographer,
      title: entry.title,
      order: startOrder + i++,
      importBatch
    });
  }
  return contestants;
}
