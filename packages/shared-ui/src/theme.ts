// Theme handling, matching russl.dev's own approach: an explicit
// data-theme attribute on <html>, persisted to localStorage, defaulting
// to dark. No prefers-color-scheme dependency, so the suite always looks
// the same as the portfolio site regardless of OS setting.

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'wdps-theme';

export function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme(current: Theme): Theme {
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

// Inline-script source for a <script> tag placed before first paint, so
// the theme is correct on load with no flash-of-wrong-theme. Mirrors
// russl.dev's own inline theme script.
export const INLINE_THEME_SCRIPT =
  `document.documentElement.dataset.theme = localStorage.getItem('${STORAGE_KEY}') || 'dark';`;
