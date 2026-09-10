<script lang="ts">
  import type { Entry } from '../../lib/types.js';

  let {
    entry,
    rank,
    canDelete,
    dragging,
    onRequestDelete,
    onDragStart,
    onDragEnd,
    onDropOn
  }: {
    entry: Entry;
    rank: number;
    canDelete: boolean;
    dragging: boolean;
    onRequestDelete: (entry: Entry) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onDropOn: (id: string) => void;
  } = $props();

  let resolution = $derived(entry.width && entry.height ? `${entry.width}×${entry.height}px` : '—');
</script>

<article
  class="card"
  class:dragging
  draggable={canDelete}
  ondragstart={() => onDragStart(entry.id)}
  ondragend={onDragEnd}
  ondragover={(e) => e.preventDefault()}
  ondrop={(e) => { e.preventDefault(); onDropOn(entry.id); }}
>
  <div class="thumb">
    <span class="rank" aria-hidden="true">{rank}</span>
    {#if canDelete}<span class="drag-handle" aria-hidden="true" title="drag to reorder">≡</span>{/if}
    <img src={entry.thumbnailUrl} alt="" loading="lazy" />
  </div>
  <p class="title">{entry.title}</p>
  <p class="meta dim">{resolution} · {entry.ext}</p>
  <p class="meta dim">{entry.originalFilename}</p>
  {#if canDelete}
    <button type="button" class="btn remove-btn danger-btn" onclick={() => onRequestDelete(entry)}>remove</button>
  {:else}
    <p class="dim locked-hint">competition locked</p>
  {/if}
</article>

<style>
  .card {
    border: 1px solid var(--border);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .card[draggable='true'] {
    cursor: grab;
  }
  .card.dragging {
    opacity: 0.4;
  }
  .thumb {
    position: relative;
    aspect-ratio: 4 / 3;
    background: var(--overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .thumb img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .rank {
    position: absolute;
    top: 0.35rem;
    left: 0.35rem;
    min-width: 1.4em;
    text-align: center;
    background: var(--bg);
    border: 1px solid var(--border);
    font-size: 0.8em;
    line-height: 1.4;
    z-index: 1;
  }
  .drag-handle {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--dim);
    padding: 0 0.4em;
    z-index: 1;
  }
  .title {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    margin: 0;
    font-size: 0.85em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .remove-btn {
    margin-top: 0.25rem;
  }
  .danger-btn:hover,
  .danger-btn:focus-visible {
    color: var(--danger);
    border-color: var(--danger);
  }
  .locked-hint {
    margin: 0.25rem 0 0;
    font-size: 0.85em;
  }
</style>
