<script lang="ts">
  import { imagesStore } from '../../lib/state/images.svelte.js';
  import { findLikelyMatch } from '../../lib/parsing/nameMatcher.js';
  import type { ImageRecord } from '../../lib/types.js';

  let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();

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
    imagesStore.update(record.id, { photographer: value, confidence: value.trim() ? record.confidence : 'low' });
  }

  function updateTitle(record: ImageRecord, value: string) {
    imagesStore.update(record.id, { title: value });
  }

  function applySuggestion(record: ImageRecord, name: string) {
    imagesStore.update(record.id, { photographer: name });
  }

  function removeRecord(id: string) {
    imagesStore.remove(id);
  }

  const confidenceLabel: Record<ImageRecord['confidence'], string> = {
    high: 'ok',
    medium: 'warn',
    low: 'danger'
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
          <th>confidence</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each imagesStore.all as record (record.id)}
          {@const suggestion = suggestionFor(record)}
          <tr>
            <td class="dim filename">{record.originalName}</td>
            <td>
              <input
                type="text"
                list="photographer-names"
                value={record.photographer}
                oninput={(e) => updatePhotographer(record, (e.currentTarget as HTMLInputElement).value)}
                placeholder="photographer name"
              />
              {#if suggestion}
                <div class="hint">
                  did you mean <button class="link-btn" onclick={() => applySuggestion(record, suggestion)}>{suggestion}</button>?
                </div>
              {/if}
            </td>
            <td>
              <input
                type="text"
                value={record.title}
                oninput={(e) => updateTitle(record, (e.currentTarget as HTMLInputElement).value)}
                placeholder="image title"
              />
            </td>
            <td class={confidenceLabel[record.confidence]}>{record.confidence}</td>
            <td><button class="link-btn danger" onclick={() => removeRecord(record.id)}>remove</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <datalist id="photographer-names">
    {#each confirmedNames as name}<option value={name}></option>{/each}
  </datalist>

  {#if !allConfirmed}
    <p class="warn">every image needs a photographer name and a title before you can continue.</p>
  {/if}

  <div class="nav-row">
    <button class="btn" onclick={onBack}>← back</button>
    <button class="btn primary" disabled={!allConfirmed} onclick={onNext}>continue to settings →</button>
  </div>
</section>

<style>
  .table-scroll {
    overflow-x: auto;
    margin-top: 1.25rem;
  }
  table.data input[type='text'] {
    width: 100%;
  }
  .filename {
    max-width: 22ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    font-size: 0.85em;
    margin-top: 0.2em;
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
  .nav-row {
    display: flex;
    justify-content: space-between;
    margin-top: 1.5rem;
  }
</style>
