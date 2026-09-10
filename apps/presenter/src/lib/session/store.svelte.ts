// Reactive wrapper around the IndexedDB-backed live session. The control
// panel is the only writer (via `update`/`replace`); the display window
// only ever reads. A BroadcastChannel ping is how one window tells the
// other "go re-read the database" — the message itself carries no data,
// keeping large image blobs out of postMessage entirely.

import { loadSession, saveSession } from './db.js';
import { emptySession, type LiveSession } from '../types.js';

const CHANNEL_NAME = 'wdps-presenter-live';

let session = $state<LiveSession>(emptySession());
let ready = $state(false);

const channel = new BroadcastChannel(CHANNEL_NAME);

async function reload(): Promise<void> {
  session = await loadSession();
}

channel.onmessage = () => {
  void reload();
};

reload().then(() => {
  ready = true;
});

async function persist(): Promise<void> {
  // $state.snapshot strips Svelte's reactivity proxy before handing the
  // object to IndexedDB — structured clone wants a plain object, and this
  // is the documented way to get one back out of a $state value.
  await saveSession($state.snapshot(session));
  channel.postMessage('changed');
}

export const sessionStore = {
  get current(): LiveSession {
    return session;
  },
  get ready(): boolean {
    return ready;
  },
  /** Mutate the session in place (arrays/objects are deeply reactive), then persist + notify. */
  async update(mutate: (s: LiveSession) => void): Promise<void> {
    mutate(session);
    await persist();
  },
  async replace(next: LiveSession): Promise<void> {
    session = next;
    await persist();
  }
};
