<script lang="ts">
  import type { Entry } from '../../lib/types.js';

  let {
    entry,
    canDelete,
    onRequestDelete
  }: {
    entry: Entry;
    canDelete: boolean;
    onRequestDelete: (entry: Entry) => void;
  } = $props();

  let resolution = $derived(entry.width && entry.height ? `${entry.width}×${entry.height}px` : '—');
</script>

<article class="card">
  <div class="thumb">
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
  .thumb {
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
