// Single-key navigation shortcuts, matching russl.dev's own pattern:
// a plain `keydown` listener, ignored when a modifier key is held.
//
// Unlike the portfolio site, this suite has real form fields (photographer
// name, title, competition name, the limit input...), so unlike the
// source site's handler, this one also ignores keydown while focus is
// inside an input/textarea/select/contenteditable — otherwise typing "t"
// into a text box would toggle the theme instead of typing a "t".

export type ShortcutMap = Record<string, () => void>;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Binds single-key shortcuts (e.g. { '1': () => ..., t: () => ... }). Returns an unsubscribe function. */
export function bindShortcuts(map: ShortcutMap): () => void {
  function handler(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    const action = map[e.key];
    if (!action) return;
    action();
  }
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
