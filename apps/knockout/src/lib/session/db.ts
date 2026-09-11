// The live session lives in its own IndexedDB database (separate from
// packages/shared-bus's `wdps-bus`, which is just a one-shot hand-off
// mailbox) — this one is the actual running state of a knockout night:
// every contestant, the bracket, the current scene, the slide config.
// Same-origin, so the control panel (index.html) and the full-screen
// display (display.html) both read/write the same record without a
// server, the same way shared-bus lets apps talk to each other.

import { openDB, type IDBPDatabase } from 'idb';
import type { LiveSession } from '../types.js';
import { emptySession } from '../types.js';

const DB_NAME = 'wdps-knockout';
const STORE = 'session';
const DB_VERSION = 1;
const SESSION_KEY = 'live';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      }
    });
  }
  return dbPromise;
}

export async function loadSession(): Promise<LiveSession> {
  const db = await getDb();
  const stored = await db.get(STORE, SESSION_KEY);
  return stored ?? emptySession();
}

export async function saveSession(session: LiveSession): Promise<void> {
  const db = await getDb();
  await db.put(STORE, session, SESSION_KEY);
}

export async function clearSession(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, SESSION_KEY);
}
