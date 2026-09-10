<script lang="ts">
  import type { LiveSession, PresenterImage } from '../lib/types.js';
  import { collectFromDataTransferItems, filterAcceptedFiles } from '../lib/intake/collectFiles.js';
  import { buildImagesFromFiles } from '../lib/intake/localFiles.js';
  import {
    listUploadPortalCompetitions,
    importUploadPortalCompetition,
    type UploadPortalCompetition
  } from '../lib/intake/uploadPortal.js';
  import { importProjectFile } from '../lib/export/projectFile.js';

  let {
    onImagesReady,
    onProjectImported
  }: {
    onImagesReady: (images: PresenterImage[]) => void;
    onProjectImported: (session: LiveSession) => void;
  } = $props();

  let dragOver = $state(false);
  let busy = $state(false);
  let error = $state('');

  let competitions = $state<UploadPortalCompetition[]>([]);
  let competitionsLoading = $state(true);
  let competitionsError = $state('');
  let importingId = $state('');

  $effect(() => {
    listUploadPortalCompetitions()
      .then((c) => (competitions = c))
      .catch((err) => (competitionsError = err instanceof Error ? err.message : 'could not reach upload-portal'))
      .finally(() => (competitionsLoading = false));
  });

  async function importCompetition(competition: UploadPortalCompetition) {
    if (competition.status !== 'locked') return;
    importingId = competition.id;
    competitionsError = '';
    try {
      onImagesReady(await importUploadPortalCompetition(competition.id, 0));
    } catch (err) {
      competitionsError = err instanceof Error ? err.message : 'could not import that competition';
    } finally {
      importingId = '';
    }
  }

  async function addFiles(files: File[]) {
    busy = true;
    error = '';
    try {
      const accepted = await filterAcceptedFiles(files);
      if (accepted.length === 0) {
        error = 'no .tif/.png/.jpg files found in that selection';
        return;
      }
      onImagesReady(buildImagesFromFiles(accepted, 0));
    } finally {
      busy = false;
    }
  }

  async function handleFileInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files) await addFiles(Array.from(input.files));
    input.value = '';
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (!e.dataTransfer) return;
    const files = e.dataTransfer.items?.length
      ? await collectFromDataTransferItems(e.dataTransfer.items)
      : Array.from(e.dataTransfer.files);
    await addFiles(files);
  }

  async function handleProjectFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    error = '';
    try {
      onProjectImported(await importProjectFile(file));
    } catch (err) {
      error = err instanceof Error ? err.message : 'could not read that project file';
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>load images<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="dim">tif, png or jpg — a folder or a batch of files. nothing leaves your browser.</p>

  <div
    class="dropzone"
    class:dragover={dragOver}
    role="group"
    aria-label="file drop area"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => (dragOver = false)}
    ondrop={handleDrop}
  >
    {#if busy}
      <p>reading files…</p>
    {:else}
      <p>drag files or a folder here</p>
      <p class="dim">or</p>
      <label class="btn">
        choose files
        <input type="file" accept=".tif,.tiff,.png,.jpg,.jpeg" multiple onchange={handleFileInput} hidden />
      </label>
      <label class="btn">
        choose a folder
        <input type="file" webkitdirectory multiple onchange={handleFileInput} hidden />
      </label>
    {/if}
  </div>

  {#if error}<p class="danger">{error}</p>{/if}
</section>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>from upload portal<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="dim">signed in as the wdps owner — pulls a competition's entries straight in, full quality.</p>
  {#if competitionsLoading}
    <p class="dim">loading…</p>
  {:else if competitionsError}
    <p class="danger">{competitionsError}</p>
  {:else if competitions.length === 0}
    <p class="dim">no competitions in upload-portal yet.</p>
  {:else}
    <ul class="competition-list">
      {#each competitions as competition}
        <li>
          <span>{competition.name}</span>
          <span class="dim">{competition.status} · {competition.entryCount} entr{competition.entryCount === 1 ? 'y' : 'ies'}</span>
          <button
            type="button"
            class="btn"
            disabled={competition.status !== 'locked' || competition.entryCount === 0 || importingId === competition.id}
            title={competition.status !== 'locked' ? 'lock entries in upload-portal first' : ''}
            onclick={() => importCompetition(competition)}
          >
            {importingId === competition.id ? 'importing…' : 'import'}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>resume a saved project<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="dim">re-import a project file saved earlier from the export panel.</p>
  <label class="btn">
    load project file
    <input type="file" accept=".zip" onchange={handleProjectFile} hidden />
  </label>
</section>

<style>
  .dropzone {
    border: 1px dashed var(--border);
    padding: 2.5rem 1.5rem;
    text-align: center;
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    transition: border-color 0.15s ease;
  }
  .dropzone.dragover {
    border-color: var(--amber);
  }
  .competition-list {
    list-style: none;
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .competition-list li {
    display: flex;
    align-items: center;
    gap: 1ch;
    flex-wrap: wrap;
  }
</style>
