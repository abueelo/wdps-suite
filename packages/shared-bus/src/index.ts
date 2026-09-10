// Shared cross-app hand-off bus for the wdps suite.
//
// Same-origin apps (all served under wdps.russl.dev, at their own
// sub-paths) can drop a set of files here for another compatible app to
// pick up, without any server involved. Compatibility is a plain string
// tag (`type`) — an app only offers to import payloads whose type it
// declares support for.
//
// This is intentionally simple: one IndexedDB database, one object
// store, no versioning/migration machinery beyond what `idb` gives us
// for free, because the suite is small and payloads are ephemeral
// (the user is expected to import-then-clear, not build up history).

import { openDB, type IDBPDatabase } from 'idb';

export interface BusItem {
  filename: string;
  blob: Blob;
  contentType: string;
  /**
   * Optional structured data about this item, for a producer that already
   * knows fields a consumer would otherwise have to guess at (e.g. a
   * photographer/title pair) so the consumer can skip re-deriving them from
   * `filename`. Shape is up to the producer/consumer pair — shared-bus
   * doesn't interpret it.
   */
  meta?: Record<string, unknown>;
}

export interface BusPayload {
  id: string;
  sourceApp: string;
  type: string;
  createdAt: number;
  label: string;
  items: BusItem[];
  meta?: Record<string, unknown>;
}

export type NewBusPayload = Omit<BusPayload, 'id' | 'createdAt'>;

const DB_NAME = 'wdps-bus';
const STORE = 'payloads';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('type', 'type');
        }
      }
    });
  }
  return dbPromise;
}

export async function putPayload(payload: NewBusPayload): Promise<BusPayload> {
  const full: BusPayload = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  const db = await getDb();
  await db.put(STORE, full);
  return full;
}

export async function listPayloads(type?: string | string[]): Promise<BusPayload[]> {
  const db = await getDb();
  let all: BusPayload[];
  if (!type) {
    all = await db.getAll(STORE);
  } else if (Array.isArray(type)) {
    const seen = new Set<string>();
    all = [];
    for (const t of type) {
      for (const payload of await db.getAllFromIndex(STORE, 'type', t)) {
        if (seen.has(payload.id)) continue;
        seen.add(payload.id);
        all.push(payload);
      }
    }
  } else {
    all = await db.getAllFromIndex(STORE, 'type', type);
  }
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPayload(id: string): Promise<BusPayload | undefined> {
  const db = await getDb();
  return db.get(STORE, id);
}

export async function deletePayload(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

// The type tag this app's finalized export uses, so other apps can
// declare support for it. Kept here (rather than duplicated per-app)
// since it's the contract between producer and consumer.
export const IMAGE_SET_TYPE = 'image-set-jpeg-1920-72dpi';

// A raw, unprocessed batch of competition entries — original bytes in
// whatever format they were submitted in (tiff/png/jpeg), not yet resized
// or renamed. Distinct from IMAGE_SET_TYPE, which specifically means
// comp-sheets' own *finished* export: importing a raw batch under that tag
// would make comp-sheets treat un-resized originals as if already done.
export const RAW_ENTRY_SET_TYPE = 'raw-entry-set';

// A small static manifest of the suite's apps and what payload types
// each one accepts. This is what "send to another app" checks against —
// an app should only ever be offered as a destination if it actually
// declares support for the payload type being sent, and the option
// should disappear entirely if no other app currently does.
export interface SuiteApp {
  id: string;
  name: string;
  path: string;
  acceptedTypes: string[];
}

export const SUITE_APPS: SuiteApp[] = [
  { id: 'comp-sheets', name: 'comp-sheets', path: '/comp-sheets/', acceptedTypes: [IMAGE_SET_TYPE, RAW_ENTRY_SET_TYPE] },
  { id: 'upload-portal', name: 'upload-portal', path: '/upload-portal/admin.html', acceptedTypes: [] },
  { id: 'presenter', name: 'presenter', path: '/presenter/', acceptedTypes: [IMAGE_SET_TYPE] }
];

/** Other apps (excluding `excludeId`) that accept `type`. */
export function compatibleApps(type: string, excludeId?: string): SuiteApp[] {
  return SUITE_APPS.filter((a) => a.id !== excludeId && a.acceptedTypes.includes(type));
}
