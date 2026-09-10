<script lang="ts">
  import { imagesStore } from '../../lib/state/images.svelte.js';
  import { findLikelyMatch } from '../../lib/parsing/nameMatcher.js';
  import { generatePreviewUrl } from '../../lib/upload/preview.js';
  import type { ImageRecord } from '../../lib/types.js';
  import { ConfirmModal } from '@wdps/shared-ui';

  let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();

  // Memoized per-record preview promises — {#await} re-evaluates on every
  // render, so without this cache each keystroke would kick off a fresh
  // decode of every row's image.
  const previewCache = new Map<string, Promise<string>>();
  function previewFor(record: ImageRecord): Promise<string> {
    let promise = previewCache.get(record.id);
    if (!promise) {
      promise = generatePreviewUrl(record.originalFile);
      previewCache.set(record.id, promise);
    }
    return promise;
  }

  $effect(() => {
    return () => {
      for (const promise of previewCache.values()) {
        promise.then((url) => URL.revokeObjectURL(url)).catch(() => {});
      }
    };
  });

  let confirmedNames = $derived(
    [...new Set(imagesStore.all.map((r) => r.photographer).filter(Boolean))].sort()
  );

  let allConfirmed = $derived(
    imagesStore.all.length > 0 &&
      imagesStore.all.every((r) => r.photographer.trim() && r.title.trim())
  );

  function suggestionFor(record: ImageRecord): string | null {
    if (!record.photographer) return null;
    const others = confirmedNames.filter((n) => n !== record.photographer);
    const match = findLikelyMatch(record.photographer, others);
    return match;
  }

  function updatePhotographer(record: ImageRecord, value: string) {
    imagesStore.update(record.id, { photographer: value, formatting: value.trim() ? record.formatting : 'attention' });
  }

  function updateTitle(record: ImageRecord, value: string) {
    imagesStore.update(record.id, { title: value });
  }

  function applySuggestion(record: ImageRecord, name: string) {
    imagesStore.update(record.id, { photographer: name });
  }

  let pendingRemove = $state<ImageRecord | null>(null);

  function confirmRemoveRecord() {
    if (!pendingRemove) return;
    imagesStore.remove(pendingRemove.id);
    pendingRemove = null;
  }

  const formattingLabel: Record<ImageRecord['formatting'], string> = {
    ok: 'correctly formatted',
    attention: 'needs attention'
  };

  const formattingClass: Record<ImageRecord['formatting'], string> = {
    ok: 'ok',
    attention: 'warn'
  };
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>review<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="dim">check every photographer name and image title before continuing — nothing is renamed or processed yet.</p>

  <div class="table-scroll">
    <table class="data">
      <thead>
        <tr>
          <th>file</th>
          <th>photographer</th>
          <th>title</th>
          <th>formatting</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each imagesStore.all as record (record.id)}
          {@const suggestion = suggestionFor(record)}
          <tr>
            <td class="filename">
              <div class="thumb-wrap">
                {#await previewFor(record)}
                  <div class="thumb-placeholder"></div>
                {:then url}
                  <img class="thumb" src={url} alt="" />
                {:catch}
                  <div class="thumb-placeholder">?</div>
                {/await}
              </div>
              <div class="dim filename-text">{record.originalName}</div>
            </td>
            <td>
              <div class="input-wrap">
                <input
                  type="text"
                  autocomplete={"do-not-autofill" as any}
                  value={record.photographer}
                  oninput={(e) => updatePhotographer(record, (e.currentTarget as HTMLInputElement).value)}
                  placeholder="photographer name"
                />
                {#if suggestion}
                  <div class="hint">
                    did you mean <button class="link-btn" onclick={() => applySuggestion(record, suggestion)}>{suggestion}</button>?
                  </div>
                {/if}
              </div>
            </td>
            <td>
              <input
                type="text"
                autocomplete={"do-not-autofill" as any}
                value={record.title}
                oninput={(e) => updateTitle(record, (e.currentTarget as HTMLInputElement).value)}
                placeholder="image title"
              />
            </td>
            <td class={formattingClass[record.formatting]}>{formattingLabel[record.formatting]}</td>
            <td><button class="link-btn danger remove-btn" onclick={() => (pendingRemove = record)} aria-label="remove image">×</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if !allConfirmed}
    <p class="warn">every image needs a photographer name and a title before you can continue.</p>
  {/if}

  <div class="nav-row">
    <button class="btn" onclick={onBack}>← back</button>
    <button class="btn primary" disabled={!allConfirmed} onclick={onNext}>continue to settings →</button>
  </div>
</section>

{#if pendingRemove}
  <ConfirmModal
    message={`Remove "${pendingRemove.originalName}" from this batch? This can't be undone.`}
    confirmLabel="remove"
    onConfirm={confirmRemoveRecord}
    onCancel={() => (pendingRemove = null)}
  />
{/if}

<style>
  .table-scroll {
    overflow-x: auto;
    margin-top: 1.25rem;
  }
  table.data input[type='text'] {
    width: 100%;
  }
  .thumb-wrap {
    height: 128px;
  }
  .thumb {
    height: 128px;
    width: auto;
    max-width: 220px;
    object-fit: contain;
    border: 1px solid var(--border);
    display: block;
  }
  .thumb-placeholder {
    width: 96px;
    height: 128px;
    border: 1px dashed var(--border);
  }
  .filename-text {
    margin-top: 0.4em;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .input-wrap {
    position: relative;
  }
  .hint {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.3em;
    font-size: 0.85em;
    z-index: 1;
    white-space: nowrap;
  }
  .link-btn {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    color: var(--amber);
    cursor: pointer;
  }
  .link-btn:hover {
    text-decoration: underline;
  }
  .link-btn.danger {
    color: var(--danger);
  }
  .remove-btn {
    font-size: 1.2em;
    line-height: 1;
  }
  .link-btn.remove-btn:hover {
    text-decoration: none;
  }
  .nav-row {
    display: flex;
    justify-content: space-between;
    margin-top: 1.5rem;
  }
</style>
