<script lang="ts">
  import type { Competition } from '../../lib/types.js';
  import { filterAcceptedFiles } from '../../lib/upload/collectFiles.js';
  import { decodeForUpload } from '../../lib/upload/thumbnail.js';
  import { uploadEntry } from '../../lib/api/client.js';

  let { competition, onBack }: { competition: Competition; onBack: () => void } = $props();

  interface Row {
    id: string;
    file: File;
    title: string;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
  }

  // One name for the whole session rather than re-typing it per image —
  // a member is almost always uploading their own batch in one sitting.
  let photographer = $state('');
  let rows = $state<Row[]>([]);
  let dragOver = $state(false);
  let collecting = $state(false);
  let submitting = $state(false);

  let readyCount = $derived(rows.filter((r) => r.status === 'pending' && r.title.trim()).length);
  let doneCount = $derived(rows.filter((r) => r.status === 'done').length);

  async function addFiles(files: File[]) {
    collecting = true;
    try {
      const accepted = await filterAcceptedFiles(files);
      rows = [
        ...rows,
        ...accepted.map((file) => ({ id: crypto.randomUUID(), file, title: '', status: 'pending' as const }))
      ];
    } finally {
      collecting = false;
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
    if (e.dataTransfer?.files) await addFiles(Array.from(e.dataTransfer.files));
  }

  function removeRow(id: string) {
    rows = rows.filter((r) => r.id !== id);
  }

  async function uploadAll() {
    if (!photographer.trim()) return;
    submitting = true;
    try {
      for (const row of rows) {
        if (row.status !== 'pending' && row.status !== 'error') continue;
        if (!row.title.trim()) continue;

        row.status = 'uploading';
        try {
          const { width, height, thumbnail } = await decodeForUpload(row.file);
          const form = new FormData();
          form.set('original', row.file);
          form.set('thumbnail', thumbnail, 'thumbnail.jpg');
          form.set('photographer', photographer.trim());
          form.set('title', row.title.trim());
          form.set('filename', row.file.name);
          form.set('width', String(width));
          form.set('height', String(height));
          await uploadEntry(competition.id, form);
          row.status = 'done';
        } catch (err) {
          row.status = 'error';
          row.error = err instanceof Error ? err.message : 'upload failed';
        }
      }
    } finally {
      submitting = false;
    }
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>{competition.name}<span class="bracket" aria-hidden="true"> ]</span></h2>
  <button type="button" class="btn back-link" onclick={onBack}>&larr; pick a different competition</button>

  <label class="field">
    <span class="dim">your name</span>
    <input type="text" bind:value={photographer} placeholder="how it should appear on your entries" autocomplete="off" />
  </label>

  <div
    class="dropzone"
    class:dragover={dragOver}
    role="group"
    aria-label="file drop area"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => (dragOver = false)}
    ondrop={handleDrop}
  >
    {#if collecting}
      <p>reading files…</p>
    {:else}
      <p>drag images here</p>
      <p class="dim">or</p>
      <label class="btn">
        choose files
        <input type="file" accept=".tif,.tiff,.png,.jpg,.jpeg" multiple onchange={handleFileInput} hidden />
      </label>
    {/if}
  </div>

  {#if rows.length > 0}
    <ul class="row-list">
      {#each rows as row (row.id)}
        <li class:done={row.status === 'done'}>
          <span class="filename">{row.file.name}</span>
          <input
            type="text"
            bind:value={row.title}
            placeholder="title"
            disabled={row.status === 'uploading' || row.status === 'done'}
          />
          {#if row.status === 'done'}
            <span class="ok">uploaded</span>
          {:else if row.status === 'uploading'}
            <span class="dim">uploading…</span>
          {:else}
            <button type="button" class="btn" onclick={() => removeRow(row.id)}>remove</button>
          {/if}
          {#if row.status === 'error'}<span class="danger">{row.error}</span>{/if}
        </li>
      {/each}
    </ul>

    <button class="btn primary" onclick={uploadAll} disabled={submitting || readyCount === 0 || !photographer.trim()}>
      {submitting ? 'uploading…' : `upload ${readyCount} image${readyCount === 1 ? '' : 's'}`}
    </button>
    {#if doneCount > 0}<p class="ok">{doneCount} uploaded so far.</p>{/if}
  {/if}
</section>

<style>
  .back-link {
    margin-top: 0.75rem;
    border-color: transparent;
    padding-left: 0;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 1.25rem;
    max-width: 24rem;
  }
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
  .btn input[hidden] {
    display: none;
  }
  .row-list {
    list-style: none;
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .row-list li {
    display: flex;
    align-items: center;
    gap: 1ch;
    flex-wrap: wrap;
  }
  .row-list li.done {
    opacity: 0.6;
  }
  .filename {
    min-width: 10rem;
    max-width: 16rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-list input {
    flex: 1;
    min-width: 10rem;
  }
</style>
