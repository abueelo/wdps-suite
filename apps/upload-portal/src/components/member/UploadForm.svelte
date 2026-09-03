<script lang="ts">
  import type { Competition } from '../../lib/types.js';
  import { filterAcceptedFiles } from '../../lib/upload/collectFiles.js';
  import { decodeForUpload } from '../../lib/upload/thumbnail.js';
  import { guessTitle } from '../../lib/upload/guessTitle.js';
  import { uploadEntry } from '../../lib/api/client.js';

  let { competition, onBack }: { competition: Competition; onBack: () => void } = $props();

  interface Row {
    id: string;
    file: File;
    title: string;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
    thumbnailUrl?: string;
    decoded?: { width: number; height: number; thumbnail: Blob };
    decodeFailed?: boolean;
  }

  // One name for the whole session rather than re-typing it per image —
  // a member is almost always uploading their own batch in one sitting.
  let photographer = $state('');
  let rows = $state<Row[]>([]);
  let dragOver = $state(false);
  let dragging = $state<string | null>(null);
  let collecting = $state(false);
  let submitting = $state(false);

  // Plain (non-reactive) list of object URLs created for thumbnails, so
  // they can all be revoked on unmount without re-running on every
  // rows change (a $state read inside the effect body would do that).
  const createdUrls: string[] = [];
  $effect(() => {
    return () => {
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };
  });

  let readyCount = $derived(rows.filter((r) => r.status === 'pending' && r.title.trim()).length);
  let doneCount = $derived(rows.filter((r) => r.status === 'done').length);

  async function decodeRow(row: Row) {
    try {
      const decoded = await decodeForUpload(row.file);
      row.decoded = decoded;
      const url = URL.createObjectURL(decoded.thumbnail);
      createdUrls.push(url);
      row.thumbnailUrl = url;
    } catch {
      row.decodeFailed = true;
    }
  }

  async function addFiles(files: File[]) {
    collecting = true;
    try {
      const accepted = await filterAcceptedFiles(files);
      const newIds = accepted.map(() => crypto.randomUUID());
      rows = [
        ...rows,
        ...accepted.map((file, i): Row => ({ id: newIds[i], file, title: guessTitle(file.name), status: 'pending' }))
      ];
      // Re-read the just-added rows back out of `rows` rather than closing
      // over the plain objects built above — $state deeply proxies on
      // assignment, so those originals aren't the reactive objects the
      // template actually tracks, and mutating them wouldn't update the UI.
      for (const id of newIds) {
        const row = rows.find((r) => r.id === id);
        if (row) decodeRow(row);
      }
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

  // Row reordering, own drag state from the file drop zone above — this
  // one just reorders the queue, doesn't accept dropped files.
  function reorderRow(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const fromIdx = rows.findIndex((r) => r.id === draggedId);
    const toIdx = rows.findIndex((r) => r.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...rows];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    rows = next;
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
          const decoded = row.decoded ?? (await decodeForUpload(row.file));
          const form = new FormData();
          form.set('original', row.file);
          form.set('thumbnail', decoded.thumbnail, 'thumbnail.jpg');
          form.set('photographer', photographer.trim());
          form.set('title', row.title.trim());
          form.set('filename', row.file.name);
          form.set('width', String(decoded.width));
          form.set('height', String(decoded.height));
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
    <input type="text" bind:value={photographer} placeholder="Jane Doe" autocomplete="off" />
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
    <p class="dim reorder-hint">drag <span aria-hidden="true">≡</span> to reorder</p>
    <ul class="row-list">
      {#each rows as row (row.id)}
        {@const editable = row.status === 'pending' || row.status === 'error'}
        <li
          class:done={row.status === 'done'}
          class:dragging={dragging === row.id}
          draggable={editable}
          ondragstart={() => { dragging = row.id; }}
          ondragover={(e) => e.preventDefault()}
          ondrop={(e) => { e.preventDefault(); if (dragging) reorderRow(dragging, row.id); dragging = null; }}
          ondragend={() => { dragging = null; }}
        >
          <span class="drag-handle" aria-hidden="true">≡</span>
          <div class="thumb-wrap">
            {#if row.thumbnailUrl}
              <img class="thumb" src={row.thumbnailUrl} alt="" />
            {:else if row.decodeFailed}
              <div class="thumb-placeholder">?</div>
            {:else}
              <div class="thumb-placeholder"></div>
            {/if}
          </div>
          <span class="filename">{row.file.name}</span>
          <input
            type="text"
            bind:value={row.title}
            placeholder="title"
            disabled={!editable}
          />
          {#if row.status === 'done'}
            <span class="ok">uploaded</span>
          {:else if row.status === 'uploading'}
            <span class="dim">uploading…</span>
          {:else}
            <button type="button" class="btn remove-btn" onclick={() => removeRow(row.id)} aria-label="remove">×</button>
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
    align-items: center;
    gap: 1ch;
    margin-top: 1.25rem;
  }
  .field input {
    flex: 1;
    max-width: 18rem;
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
  .reorder-hint {
    margin-top: 1.25rem;
    font-size: 0.85em;
  }
  .row-list {
    list-style: none;
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .row-list li {
    display: flex;
    align-items: center;
    gap: 1ch;
    flex-wrap: wrap;
    cursor: grab;
  }
  .row-list li.dragging {
    opacity: 0.4;
    cursor: grabbing;
  }
  .row-list li.done {
    opacity: 0.6;
    cursor: default;
  }
  .drag-handle {
    color: var(--dim);
  }
  .thumb-wrap {
    height: 64px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .thumb {
    height: 64px;
    width: auto;
    max-width: 96px;
    object-fit: contain;
    border: 1px solid var(--border);
    display: block;
  }
  .thumb-placeholder {
    width: 64px;
    height: 64px;
    border: 1px dashed var(--border);
  }
  .filename {
    min-width: 8rem;
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-list input {
    flex: 1;
    min-width: 10rem;
  }
  .remove-btn {
    font-size: 1.2em;
    line-height: 1;
    padding: 0.2em 0.7em;
  }
</style>
