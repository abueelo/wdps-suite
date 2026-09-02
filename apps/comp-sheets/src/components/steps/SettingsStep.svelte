<script lang="ts">
  import { imagesStore } from '../../lib/state/images.svelte.js';
  import { settingsStore } from '../../lib/state/settings.svelte.js';
  import { computeCaps, isCapError, type PhotographerCount } from '../../lib/fairness/tierCap.js';
  import type { ImageRecord } from '../../lib/types.js';

  let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();

  let grouped = $derived.by(() => {
    const map = new Map<string, ImageRecord[]>();
    for (const r of imagesStore.all) {
      const list = map.get(r.photographer) ?? [];
      list.push(r);
      map.set(r.photographer, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.priority - b.priority);
    return map;
  });

  let photographerCounts = $derived<PhotographerCount[]>(
    [...grouped.entries()].map(([photographer, list]) => ({ photographer, submittedCount: list.length }))
  );

  let capResult = $derived(computeCaps(photographerCounts, settingsStore.value.limit));

  function isIncluded(record: ImageRecord): boolean {
    if (isCapError(capResult)) return false;
    const cap = capResult.caps[record.photographer] ?? 0;
    return record.priority < cap;
  }

  function move(record: ImageRecord, direction: -1 | 1) {
    const siblings = grouped.get(record.photographer) ?? [];
    const idx = siblings.findIndex((r) => r.id === record.id);
    const swapWith = siblings[idx + direction];
    if (!swapWith) return;
    imagesStore.update(record.id, { priority: swapWith.priority });
    imagesStore.update(swapWith.id, { priority: record.priority });
  }

  // Drag-and-drop reordering, scoped to one photographer's list at a
  // time (dragging across photographers wouldn't mean anything — cap
  // priority is per-photographer). The arrow buttons stay as a
  // keyboard/screen-reader-usable fallback since native drag-and-drop
  // isn't operable that way.
  let dragging = $state<{ photographer: string; recordId: string } | null>(null);

  function reorderWithinGroup(photographer: string, draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const list = [...(grouped.get(photographer) ?? [])];
    const fromIdx = list.findIndex((r) => r.id === draggedId);
    const toIdx = list.findIndex((r) => r.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    list.forEach((r, i) => imagesStore.update(r.id, { priority: i }));
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>settings<span class="bracket" aria-hidden="true"> ]</span></h2>

  <div class="field">
    <label for="limit">total image limit</label>
    <input
      id="limit"
      type="number"
      min="1"
      autocomplete="off"
      value={settingsStore.value.limit}
      oninput={(e) => settingsStore.update({ limit: Number((e.currentTarget as HTMLInputElement).value) || 0 })}
    />
  </div>

  <div class="field">
    <label>
      <input
        type="checkbox"
        checked={settingsStore.value.randomizeOrder}
        onchange={(e) => settingsStore.update({ randomizeOrder: (e.currentTarget as HTMLInputElement).checked })}
      />
      randomise order for competition
    </label>
  </div>

  <div class="field">
    <label>
      <input
        type="checkbox"
        checked={settingsStore.value.includeThumbnails}
        onchange={(e) => settingsStore.update({ includeThumbnails: (e.currentTarget as HTMLInputElement).checked })}
      />
      include a thumbnail column in the score sheets
    </label>
    <p class="dim hint">larger file, slower export — off by default</p>
  </div>

  {#if isCapError(capResult)}
    <p class="danger">
      {capResult.photographerCount} photographers each need at least 1 image ({capResult.photographerCount} total),
      but the limit is {capResult.limit}. Raise the limit to at least {capResult.photographerCount}.
    </p>
  {:else}
    <p class="ok">
      cap: {capResult.tier} image{capResult.tier === 1 ? '' : 's'} per photographer · {capResult.totalSelected} / {settingsStore.value.limit} included
      {#if !capResult.fullySatisfied}<span class="dim">(not everyone's full set fits — as close as possible)</span>{/if}
    </p>
  {/if}
</section>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>which images count<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="dim">reorder a photographer's images if you want different ones to make the cut.</p>

  {#each [...grouped.entries()] as [photographer, list]}
    <div class="photographer-group">
      <p class="photographer-name">{photographer || '(unnamed)'}</p>
      <ol>
        {#each list as record, i (record.id)}
          <li
            class:excluded={!isIncluded(record)}
            class:dragging={dragging?.recordId === record.id}
            draggable="true"
            ondragstart={() => { dragging = { photographer, recordId: record.id }; }}
            ondragover={(e) => e.preventDefault()}
            ondrop={(e) => {
              e.preventDefault();
              if (dragging && dragging.photographer === photographer) reorderWithinGroup(photographer, dragging.recordId, record.id);
              dragging = null;
            }}
            ondragend={() => { dragging = null; }}
          >
            <span class="drag-handle" aria-hidden="true">≡</span>
            <span class="pos">{i + 1}.</span>
            <span class="title">{record.title || record.originalName}</span>
            {#if !isIncluded(record)}<span class="dim">— excluded (over cap)</span>{/if}
            <span class="move-buttons">
              <button class="link-btn" disabled={i === 0} onclick={() => move(record, -1)} aria-label="move up">↑</button>
              <button class="link-btn" disabled={i === list.length - 1} onclick={() => move(record, 1)} aria-label="move down">↓</button>
            </span>
          </li>
        {/each}
      </ol>
    </div>
  {/each}

  <div class="nav-row">
    <button class="btn" onclick={onBack}>← back</button>
    <button class="btn primary" disabled={isCapError(capResult)} onclick={onNext}>continue to export →</button>
  </div>
</section>

<style>
  .field {
    margin-top: 1rem;
  }
  .field label {
    display: flex;
  }
  .field input[type='number'] {
    display: block;
    margin-top: 0.3rem;
    width: 10ch;
  }
  .hint {
    margin-top: 0.2rem;
  }
  .photographer-group {
    margin-top: 1.25rem;
  }
  .photographer-name {
    color: var(--amber);
  }
  ol {
    list-style: none;
    margin-top: 0.4rem;
  }
  ol li {
    display: flex;
    align-items: center;
    gap: 0.75ch;
    padding: 0.2em 0;
    border-bottom: 1px dotted var(--border);
    cursor: grab;
  }
  ol li.dragging {
    opacity: 0.4;
    cursor: grabbing;
  }
  ol li.excluded {
    color: var(--dim);
    text-decoration: line-through;
    text-decoration-color: var(--border-hover);
  }
  .drag-handle {
    color: var(--dim);
  }
  .pos {
    color: var(--dim);
    min-width: 2ch;
  }
  .move-buttons {
    margin-left: auto;
    display: flex;
    gap: 0.5ch;
  }
  .link-btn {
    font: inherit;
    background: none;
    border: none;
    padding: 0 0.3em;
    color: var(--fg);
    cursor: pointer;
  }
  .link-btn:hover:not(:disabled) {
    color: var(--amber);
  }
  .link-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .nav-row {
    display: flex;
    justify-content: space-between;
    margin-top: 1.5rem;
  }
</style>
