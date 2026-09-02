<script lang="ts">
  import { imagesStore } from '../../lib/state/images.svelte.js';
  import { parseFilename } from '../../lib/parsing/filenameParser.js';
  import { collectFromDataTransferItems, filterAcceptedFiles } from '../../lib/upload/collectFiles.js';
  import { listPayloads, IMAGE_SET_TYPE, type BusPayload } from '@wdps/shared-bus';
  import type { ImageRecord } from '../../lib/types.js';

  let { onNext }: { onNext: () => void } = $props();

  let dragOver = $state(false);
  let busy = $state(false);
  let error = $state('');
  let busPayloads = $state<BusPayload[]>([]);

  $effect(() => {
    listPayloads(IMAGE_SET_TYPE).then((p) => (busPayloads = p));
  });

  function buildRecords(files: File[]): ImageRecord[] {
    const perPhotographerCount = new Map<string, number>();
    return files.map((file) => {
      const parsed = parseFilename(file.name);
      const count = perPhotographerCount.get(parsed.photographer) ?? 0;
      perPhotographerCount.set(parsed.photographer, count + 1);
      return {
        id: crypto.randomUUID(),
        originalFile: file,
        originalName: file.name,
        photographer: parsed.photographer,
        title: parsed.title,
        confidence: parsed.confidence,
        confirmed: false,
        priority: count
      };
    });
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
      imagesStore.add(buildRecords(accepted));
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

  async function importFromBus(payload: BusPayload) {
    busy = true;
    error = '';
    try {
      const files = payload.items.map(
        (item) => new File([item.blob], item.filename, { type: item.contentType })
      );
      await addFiles(files);
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>upload<span class="bracket" aria-hidden="true"> ]</span></h2>
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

  {#if imagesStore.all.length > 0}
    <p class="ok">{imagesStore.all.length} image{imagesStore.all.length === 1 ? '' : 's'} loaded</p>
    <button class="btn primary" onclick={onNext}>continue to review →</button>
  {/if}
</section>

{#if busPayloads.length > 0}
  <section class="panel">
    <h2><span class="bracket" aria-hidden="true">[ </span>from another wdps app<span class="bracket" aria-hidden="true"> ]</span></h2>
    <ul class="bus-list">
      {#each busPayloads as payload}
        <li>
          <span>{payload.label}</span>
          <span class="dim">{payload.items.length} image{payload.items.length === 1 ? '' : 's'} · from {payload.sourceApp}</span>
          <button class="btn" onclick={() => importFromBus(payload)}>import</button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

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
  .btn input[hidden] {
    display: none;
  }
  .bus-list {
    list-style: none;
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .bus-list li {
    display: flex;
    align-items: center;
    gap: 1ch;
    flex-wrap: wrap;
  }
</style>
