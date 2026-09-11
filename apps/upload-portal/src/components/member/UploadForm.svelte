<script lang="ts">
  import { tick } from 'svelte';
  import type { Competition, Entry } from '../../lib/types.js';
  import { filterAcceptedFiles } from '../../lib/upload/collectFiles.js';
  import { decodeForUpload } from '../../lib/upload/thumbnail.js';
  import { guessTitle } from '../../lib/upload/guessTitle.js';
  import { listMyEntries, uploadEntry, deleteMyEntry, reorderMyEntries } from '../../lib/api/client.js';
  import { ConfirmModal } from '@wdps/shared-ui';
  import MyEntryCard from './MyEntryCard.svelte';

  let {
    competition,
    photographer,
    onBack,
    onChangeName
  }: { competition: Competition; photographer: string; onBack: () => void; onChangeName: () => void } = $props();

  interface Row {
    id: string;
    file: File;
    title: string;
    // true while the title is still whatever guessTitle() produced — a
    // manual edit clears this. Lets the guess get recomputed once a name
    // is typed after files were already dropped, without ever
    // clobbering something the member actually typed themselves.
    titleAuto: boolean;
    status: 'pending' | 'uploading' | 'error';
    error?: string;
    // 0-100, bytes-uploaded progress while status is 'uploading'.
    progress: number;
    thumbnailUrl?: string;
    decoded?: { width: number; height: number; thumbnail: Blob };
    decodeFailed?: boolean;
  }

  let rows = $state<Row[]>([]);
  let dragOver = $state(false);
  let dragging = $state<string | null>(null);
  let collecting = $state(false);
  let submitting = $state(false);

  // What this member has already submitted to this competition, fetched
  // from the server rather than kept in session-only state — this is what
  // makes uploads visible (and removable) across visits. Seeded from the
  // `competition` prop so "still open" doesn't flicker false while loading.
  let existingEntries = $state<Entry[]>([]);
  let loadingExisting = $state(true);
  let existingError = $state('');
  let existingSectionEl = $state<HTMLElement | null>(null);
  let liveCompetition = $state<Competition>(competition);
  let canDelete = $derived(liveCompetition.status === 'open');

  // Drag state and persistence for reordering the "already uploaded" grid —
  // separate from `dragging` below, which is the pre-upload queue's own.
  let draggingEntryId = $state<string | null>(null);
  let reorderError = $state('');

  async function reorderExisting(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const fromIdx = existingEntries.findIndex((e) => e.id === draggedId);
    const toIdx = existingEntries.findIndex((e) => e.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...existingEntries];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const previous = existingEntries;
    existingEntries = next;
    reorderError = '';
    try {
      const res = await reorderMyEntries(
        competition.id,
        photographer,
        next.map((e) => e.id)
      );
      existingEntries = res.entries;
    } catch (err) {
      existingEntries = previous;
      reorderError = err instanceof Error ? err.message : 'failed to save that order';
    }
  }

  $effect(() => {
    (async () => {
      loadingExisting = true;
      try {
        const res = await listMyEntries(competition.id, photographer);
        liveCompetition = res.competition;
        existingEntries = res.entries;
      } catch (err) {
        existingError = err instanceof Error ? err.message : 'failed to load your uploads';
      } finally {
        loadingExisting = false;
      }
    })();
  });

  // Plain (non-reactive) list of object URLs created for thumbnails, so
  // they can all be revoked on unmount without re-running on every
  // rows change (a $state read inside the effect body would do that).
  const createdUrls: string[] = [];
  $effect(() => {
    return () => {
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };
  });

  // Re-guesses every still-untouched title — covers dropping files before
  // the guess has anything to work with beyond the filename.
  $effect(() => {
    for (const row of rows) {
      if (row.titleAuto) {
        const guessed = guessTitle(row.file.name, photographer);
        if (row.title !== guessed) row.title = guessed;
      }
    }
  });

  // 'error' counts as ready too, matching uploadAll()'s own retry condition —
  // otherwise a failed row locks the button at 0 with no way to retry it.
  let readyCount = $derived(rows.filter((r) => (r.status === 'pending' || r.status === 'error') && r.title.trim()).length);
  let untitledCount = $derived(rows.filter((r) => (r.status === 'pending' || r.status === 'error') && !r.title.trim()).length);

  // Tracked separately from `submitting` so the button can say how far
  // through a multi-file batch it is, not just that it's busy.
  let uploadTotal = $state(0);
  let uploadDone = $state(0);
  // Stays up after the batch finishes (outside the {#if rows.length > 0}
  // block below) — the confirmed uploads land in "your uploads so far" at
  // the top of the page, easy to miss if you're still scrolled down at
  // the upload button, so this says right here whether it actually worked.
  let uploadSummary = $state('');

  let disabledReason = $derived.by(() => {
    if (submitting) return '';
    if (readyCount === 0 && untitledCount > 0) return `give ${untitledCount === 1 ? 'that image' : 'each image'} a title first`;
    return '';
  });

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
    uploadSummary = '';
    try {
      const accepted = await filterAcceptedFiles(files);
      const newIds = accepted.map(() => crypto.randomUUID());
      rows = [
        ...rows,
        ...accepted.map((file, i): Row => ({ id: newIds[i], file, title: guessTitle(file.name, photographer), titleAuto: true, status: 'pending', progress: 0 }))
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

  let pendingRemove = $state<Row | null>(null);

  function confirmRemoveRow() {
    if (!pendingRemove) return;
    rows = rows.filter((r) => r.id !== pendingRemove!.id);
    pendingRemove = null;
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
    submitting = true;
    uploadTotal = readyCount;
    uploadDone = 0;
    uploadSummary = '';
    let succeeded = 0;
    let failed = 0;
    try {
      for (const row of rows) {
        if (row.status !== 'pending' && row.status !== 'error') continue;
        if (!row.title.trim()) continue;

        row.status = 'uploading';
        row.progress = 0;
        try {
          const decoded = row.decoded ?? (await decodeForUpload(row.file));
          const form = new FormData();
          form.set('original', row.file);
          form.set('thumbnail', decoded.thumbnail, 'thumbnail.jpg');
          form.set('photographer', photographer);
          form.set('title', row.title.trim());
          form.set('filename', row.file.name);
          form.set('width', String(decoded.width));
          form.set('height', String(decoded.height));
          const uploaded = await uploadEntry(competition.id, form, (fraction) => {
            row.progress = Math.round(fraction * 100);
          });
          // Moves straight into the "already uploaded" list rather than
          // sitting in `rows` with a 'done' status — that list is the one
          // source of truth for anything the server actually has.
          existingEntries = [...existingEntries, uploaded];
          rows = rows.filter((r) => r.id !== row.id);
          succeeded++;
        } catch (err) {
          row.status = 'error';
          row.error = err instanceof Error ? err.message : 'upload failed';
          failed++;
        } finally {
          uploadDone++;
        }
      }
    } finally {
      submitting = false;
      if (succeeded > 0 && failed === 0) {
        uploadSummary = `✓ ${succeeded} image${succeeded === 1 ? '' : 's'} uploaded.`;
      } else if (succeeded > 0 && failed > 0) {
        uploadSummary = `✓ ${succeeded} uploaded, ${failed} failed — see below.`;
      }
      // The confirmation line sits right by the upload button, but "your
      // uploads so far" (where the new thumbnail actually lands) is back
      // up near the top of the page — easy to miss both if you don't
      // scroll. Bring that section into view once the DOM has the new
      // entry in it.
      if (succeeded > 0) {
        await tick();
        existingSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  let pendingDeleteEntry = $state<Entry | null>(null);
  let deleteBusy = $state(false);
  let deleteError = $state('');

  async function confirmDeleteEntry() {
    if (!pendingDeleteEntry) return;
    deleteBusy = true;
    deleteError = '';
    try {
      await deleteMyEntry(competition.id, pendingDeleteEntry.id, photographer);
      existingEntries = existingEntries.filter((e) => e.id !== pendingDeleteEntry!.id);
      pendingDeleteEntry = null;
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'failed to remove';
    } finally {
      deleteBusy = false;
    }
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>{competition.name}<span class="bracket" aria-hidden="true"> ]</span></h2>
  <button type="button" class="btn back-link" onclick={onBack}>&larr; pick a different competition</button>

  <p class="dim name-line">
    uploading as <strong>{photographer}</strong> —
    <button type="button" class="btn change-name-btn" onclick={onChangeName}>not you?</button>
  </p>

  {#if loadingExisting}
    <p class="dim">loading your uploads…</p>
  {:else if existingError}
    <p class="danger">{existingError}</p>
  {:else if existingEntries.length > 0}
    <h3 class="section-title" bind:this={existingSectionEl}>your uploads so far</h3>
    {#if canDelete && existingEntries.length > 1}
      <p class="dim reorder-hint">drag <span aria-hidden="true">≡</span> to put your favourites first</p>
    {/if}
    <div class="existing-grid">
      {#each existingEntries as entry, i (entry.id)}
        <MyEntryCard
          {entry}
          rank={i + 1}
          {canDelete}
          dragging={draggingEntryId === entry.id}
          onRequestDelete={(e) => (pendingDeleteEntry = e)}
          onDragStart={(id) => (draggingEntryId = id)}
          onDragEnd={() => (draggingEntryId = null)}
          onDropOn={(targetId) => {
            if (draggingEntryId) reorderExisting(draggingEntryId, targetId);
            draggingEntryId = null;
          }}
        />
      {/each}
    </div>
    {#if reorderError}<p class="danger">{reorderError}</p>{/if}
    {#if deleteError}<p class="danger">{deleteError}</p>{/if}
  {/if}

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

  {#if uploadSummary}<p class="ok upload-summary">{uploadSummary}</p>{/if}

  {#if rows.length > 0}
    <p class="dim reorder-hint">drag <span aria-hidden="true">≡</span> to reorder</p>
    <div class="row-header dim" aria-hidden="true">
      <span></span>
      <span></span>
      <span>file</span>
      <span>title</span>
      <span></span>
      <span></span>
    </div>
    <ul class="row-list">
      {#each rows as row (row.id)}
        {@const editable = row.status === 'pending' || row.status === 'error'}
        <li
          class:dragging={dragging === row.id}
          ondragover={(e) => e.preventDefault()}
          ondrop={(e) => { e.preventDefault(); if (dragging) reorderRow(dragging, row.id); dragging = null; }}
        >
          <span
            class="drag-handle"
            aria-hidden="true"
            draggable={editable}
            ondragstart={() => { dragging = row.id; }}
            ondragend={() => { dragging = null; }}
          >≡</span>
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
            class="title-input"
            type="text"
            value={row.title}
            oninput={(e) => { row.title = (e.currentTarget as HTMLInputElement).value; row.titleAuto = false; }}
            placeholder="title"
            disabled={!editable}
          />
          {#if row.status === 'uploading'}
            <div class="progress-bar row-status" role="progressbar" aria-valuenow={row.progress} aria-valuemin="0" aria-valuemax="100">
              <div class="progress-fill" style={`width: ${row.progress}%`}></div>
              <span class="progress-label">{row.progress}%</span>
            </div>
          {:else}
            <button type="button" class="btn remove-btn row-status" onclick={() => (pendingRemove = row)} aria-label="remove">×</button>
          {/if}
          {#if row.status === 'error'}<span class="danger row-error">{row.error}</span>{/if}
        </li>
      {/each}
    </ul>

    {#if disabledReason}<p class="warn upload-warn">{disabledReason}</p>{/if}
    {#if submitting}
      <div class="progress-bar batch-progress" role="progressbar" aria-valuenow={uploadDone} aria-valuemin="0" aria-valuemax={uploadTotal}>
        <div class="progress-fill" style={`width: ${uploadTotal ? (uploadDone / uploadTotal) * 100 : 0}%`}></div>
        <span class="progress-label">uploading {Math.min(uploadDone + 1, uploadTotal)} of {uploadTotal}…</span>
      </div>
    {/if}
    <button class="btn primary" onclick={uploadAll} disabled={submitting || readyCount === 0}>
      {submitting ? 'uploading…' : `upload and submit ${readyCount} image${readyCount === 1 ? '' : 's'}`}
    </button>
  {/if}
</section>

{#if pendingRemove}
  <ConfirmModal
    message={`Remove "${pendingRemove.file.name}" from this upload? This can't be undone.`}
    confirmLabel="remove"
    onConfirm={confirmRemoveRow}
    onCancel={() => (pendingRemove = null)}
  />
{/if}

{#if pendingDeleteEntry}
  <ConfirmModal
    message={`Remove "${pendingDeleteEntry.title}" from the competition? This can't be undone.`}
    confirmLabel={deleteBusy ? 'removing…' : 'remove'}
    onConfirm={confirmDeleteEntry}
    onCancel={() => (pendingDeleteEntry = null)}
  />
{/if}

<style>
  section.panel {
    --field-width: 18rem;
  }
  section.panel:hover {
    border-color: var(--border);
  }
  .back-link {
    margin-top: 0.75rem;
    border-color: transparent;
    padding-left: 0;
  }
  .name-line {
    margin-top: 1.25rem;
  }
  .change-name-btn {
    border-color: transparent;
    padding: 0;
    text-decoration: underline;
  }
  .section-title {
    margin-top: 1.5rem;
    font-size: 1em;
  }
  .existing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 1rem;
    margin-top: 0.75rem;
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
  .upload-warn {
    margin-top: 1.25rem;
  }
  .upload-summary {
    margin-top: 1.25rem;
  }
  /* labels above the columns, same widths as the row grid below, so a
     box that's already got text in it still shows what it's for. */
  .row-header {
    display: grid;
    grid-template-columns: 1.5rem 72px 11rem 1fr auto auto;
    column-gap: 1ch;
    margin-top: 0.75rem;
  }
  .row-header span {
    font-size: 0.8em;
  }
  /* a grid rather than independent flex rows, so every row's thumbnail,
     filename and title box start at the same x position regardless of
     how wide any one row's own content is — a variable-width filename
     or thumbnail no longer staggers the row below it. */
  .row-list {
    list-style: none;
    margin-top: 0.5rem;
    display: grid;
    grid-template-columns: 1.5rem 72px 11rem 1fr auto auto;
    align-items: center;
    column-gap: 1ch;
    row-gap: 0.5rem;
  }
  .row-list li {
    display: contents;
  }
  .row-list li.dragging > * {
    opacity: 0.4;
  }
  .drag-handle {
    grid-column: 1;
    color: var(--dim);
    cursor: grab;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .thumb-wrap {
    grid-column: 2;
    width: 72px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thumb {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
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
    grid-column: 3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title-input {
    grid-column: 4;
    width: 100%;
    min-width: 14rem;
  }
  .row-status {
    grid-column: 5;
  }
  .row-error {
    grid-column: 6;
  }
  .remove-btn {
    font-size: 1.2em;
    line-height: 1;
    padding: 0.2em 0.7em;
  }
  .progress-bar {
    position: relative;
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .progress-fill {
    position: absolute;
    inset: 0;
    width: 0%;
    background: var(--amber);
    opacity: 0.3;
    transition: width 0.1s linear;
  }
  .progress-label {
    position: relative;
    display: block;
    text-align: center;
    font-size: 0.75em;
    line-height: 1.6;
    white-space: nowrap;
  }
  .row-status.progress-bar {
    width: 5rem;
  }
  .batch-progress {
    margin-top: 1.25rem;
  }
  .batch-progress .progress-label {
    font-size: 0.85em;
    line-height: 1.8;
  }
</style>
