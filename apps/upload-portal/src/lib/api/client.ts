import type { Competition, Entry, PortalSettings } from '../types.js';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.error) || `request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

// -- auth --

export const adminLogin = (passcode: string) => postJson<{ ok: true }>('/api/admin-login', { passcode });
export const adminLogout = () => request<{ ok: true }>('/api/admin-logout');
export const adminMe = () => request<{ authed: boolean }>('/api/admin-me');
export const memberLogin = (passcode: string) => postJson<{ ok: true }>('/api/member-login', { passcode });

export const getSettings = () => request<PortalSettings>('/api/settings');
export const putSettings = (settings: PortalSettings) =>
  request<PortalSettings>('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });

// -- competitions --

export const listOpenCompetitions = () => request<Competition[]>('/api/competitions');
export const listAllCompetitions = () => request<Competition[]>('/api/competitions?all=1');
export const createCompetition = (name: string) => postJson<Competition>('/api/competitions', { name });
export const getCompetition = (id: string) => request<Competition>(`/api/competition/${id}`);
export const lockCompetition = (id: string) => patchJson<Competition>(`/api/competition/${id}`, { status: 'locked' });
export const renameCompetition = (id: string, name: string) => patchJson<Competition>(`/api/competition/${id}`, { name });
export const deleteCompetition = (id: string) => request<{ ok: true }>(`/api/competition/${id}`, { method: 'DELETE' });

// -- entries --

export const listEntries = (competitionId: string) =>
  request<{ competition: Competition; entries: Entry[] }>(`/api/competition/${competitionId}/entries`);

export function uploadEntry(competitionId: string, form: FormData) {
  return request<Entry>(`/api/competition/${competitionId}/entries`, { method: 'POST', body: form });
}

export const setEntryExcluded = (competitionId: string, entryId: string, excluded: boolean) =>
  patchJson<Entry>(`/api/competition/${competitionId}/entry/${entryId}`, { excluded });

export const deleteEntry = (competitionId: string, entryId: string) =>
  request<{ ok: true }>(`/api/competition/${competitionId}/entry/${entryId}`, { method: 'DELETE' });

export async function fetchEntryBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  return res.blob();
}
