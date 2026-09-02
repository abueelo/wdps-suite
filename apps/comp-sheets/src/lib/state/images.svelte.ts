import type { ImageRecord } from '../types.js';

let records = $state<ImageRecord[]>([]);

export const imagesStore = {
  get all(): ImageRecord[] {
    return records;
  },
  set(newRecords: ImageRecord[]): void {
    records = newRecords;
  },
  add(newRecords: ImageRecord[]): void {
    records = [...records, ...newRecords];
  },
  update(id: string, patch: Partial<ImageRecord>): void {
    records = records.map((r) => (r.id === id ? { ...r, ...patch } : r));
  },
  remove(id: string): void {
    records = records.filter((r) => r.id !== id);
  },
  clear(): void {
    records = [];
  }
};
