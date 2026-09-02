import * as Comlink from 'comlink';
import type { WorkerResult, Stage } from './imageWorker.js';

interface WorkerApi {
  processImage(file: File, onProgress: Comlink.ProxyMarked & ((stage: Stage) => void)): Promise<WorkerResult>;
}

export interface Job {
  id: string;
  file: File;
}

export type OnProgress = (imageId: string, stage: Stage) => void;
export type OnError = (imageId: string, error: string) => void;

const POOL_SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2)));

function spawnWorker(): { raw: Worker; api: WorkerApi } {
  const raw = new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' });
  return { raw, api: Comlink.wrap<WorkerApi>(raw) };
}

/**
 * Runs `jobs` through a bounded pool of workers (default up to 4, capped
 * by hardwareConcurrency) so peak memory stays limited to a handful of
 * decoded originals in flight at once, rather than all N upfront.
 */
export async function processJobs(
  jobs: Job[],
  onProgress: OnProgress,
  onError: OnError
): Promise<Map<string, WorkerResult>> {
  const results = new Map<string, WorkerResult>();
  const workers = Array.from({ length: Math.min(POOL_SIZE, jobs.length || 1) }, spawnWorker);

  let nextIndex = 0;
  async function runWorker({ api }: { api: WorkerApi }): Promise<void> {
    while (nextIndex < jobs.length) {
      const job = jobs[nextIndex++];
      try {
        const result = await api.processImage(
          job.file,
          Comlink.proxy((stage: Stage) => onProgress(job.id, stage))
        );
        results.set(job.id, result);
      } catch (err) {
        onError(job.id, err instanceof Error ? err.message : String(err));
      }
    }
  }

  try {
    await Promise.all(workers.map(runWorker));
  } finally {
    // Free the workers' memory now that the batch is done.
    for (const { raw } of workers) raw.terminate();
  }

  return results;
}
