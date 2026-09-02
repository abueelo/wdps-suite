import type { Settings } from '../types.js';

let settings = $state<Settings>({
  limit: 40,
  randomizeOrder: false,
  includeThumbnails: false
});

export const settingsStore = {
  get value(): Settings {
    return settings;
  },
  update(patch: Partial<Settings>): void {
    settings = { ...settings, ...patch };
  }
};
