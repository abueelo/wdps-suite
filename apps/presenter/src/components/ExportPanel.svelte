<script lang="ts">
  import type { LiveSession } from '../lib/types.js';
  import { exportProjectFile } from '../lib/export/projectFile.js';
  import { saveBlob } from '../lib/export/download.js';
  import { generateThumbnail, type Thumbnail } from '../lib/processing/thumbnail.js';

  let {
    session,
    saveProjectEl = $bindable<HTMLButtonElement | undefined>(undefined),
    exportResultsEl = $bindable<HTMLButtonElement | undefined>(undefined)
  }: {
    session: LiveSession;
    saveProjectEl?: HTMLButtonElement;
    exportResultsEl?: HTMLButtonElement;
  } = $props();

  let competitionName = $state('competition');
  let includeThumbnails = $state(true);
  let status = $state('');
  let busy = $state(false);

  export async function saveProject() {
    busy = true;
    status = 'building project file…';
    try {
      const blob = await exportProjectFile(session);
      await saveBlob(`${competitionName}.wdps-presenter.zip`, blob);
      status = 'project saved.';
    } catch (err) {
      status = err instanceof Error ? err.message : 'failed to save project';
    } finally {
      busy = false;
    }
  }

  export async function exportResults() {
    busy = true;
    status = 'building results sheet…';
    try {
      const { buildResultsDoc } = await import('../lib/export/resultsDoc.js');
      const thumbnails = new Map<string, Thumbnail>();
      if (includeThumbnails) {
        for (const img of session.images) {
          thumbnails.set(img.id, await generateThumbnail(img.blob, img.filename));
        }
      }
      const doc = await buildResultsDoc(session.images, { competitionName, includeThumbnails, thumbnails });
      await saveBlob(`${competitionName}-results.docx`, doc);
      status = 'results sheet exported.';
    } catch (err) {
      status = err instanceof Error ? err.message : 'failed to export results';
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>export<span class="bracket" aria-hidden="true"> ]</span></h2>

  <div class="field">
    <label for="competition-name">competition name</label>
    <input
      id="competition-name"
      type="text"
      value={competitionName}
      oninput={(e) => (competitionName = (e.currentTarget as HTMLInputElement).value)}
    />
  </div>

  <label class="thumb-toggle">
    <input type="checkbox" checked={includeThumbnails} onchange={(e) => (includeThumbnails = (e.currentTarget as HTMLInputElement).checked)} />
    include a thumbnail per row
  </label>

  <div class="actions">
    <button type="button" class="btn" bind:this={saveProjectEl} disabled={busy} onclick={saveProject}>
      <span class="key" aria-hidden="true">[s]</span> save project
    </button>
    <button type="button" class="btn primary" bind:this={exportResultsEl} disabled={busy || session.images.length === 0} onclick={exportResults}>
      <span class="key" aria-hidden="true">[e]</span> export results sheet
    </button>
  </div>

  {#if status}<p class="dim">{status}</p>{/if}
</section>

<style>
  .field {
    margin-top: 1rem;
  }
  .field input[type='text'] {
    display: block;
    margin-top: 0.3rem;
    width: 24ch;
  }
  .thumb-toggle {
    margin-top: 1rem;
  }
  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
</style>
