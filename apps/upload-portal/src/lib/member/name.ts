// Requires a first AND last name — a bare first name isn't enough to
// credit someone in a competition, and this is the cheapest nudge toward
// getting both without maintaining a member roster.
export function isFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

const MEMBER_NAME_KEY = 'wdps-upload-portal-member-name';

export function loadSavedName(): string {
  return localStorage.getItem(MEMBER_NAME_KEY) || '';
}

export function saveName(name: string): void {
  localStorage.setItem(MEMBER_NAME_KEY, name);
}
