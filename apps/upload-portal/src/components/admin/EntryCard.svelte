<script lang="ts">
  import type { Entry } from '../../lib/types.js';

  let {
    entry,
    onToggleExcluded,
    onRequestDelete
  }: {
    entry: Entry;
    onToggleExcluded: (entry: Entry) => void;
    onRequestDelete: (entry: Entry) => void;
  } = $props();

  let resolution = $derived(entry.width && entry.height ? `${entry.width}×${entry.height}px` : '—');
</script>

<article class="card" class:excluded={entry.excluded}>
  <div class="thumb">
    <img src={entry.thumbnailUrl} alt="" loading="lazy" />
  </div>
  <p class="title">{entry.title}</p>
  <p class="meta dim">{resolution} · {entry.ext}</p>
  <p class="meta dim">{entry.originalFilename}</p>
  <p class="actions">
    <button type="button" class="btn exclude-btn" onclick={() => onToggleExcluded(entry)}>
      {entry.excluded ? 'restore' : 'exclude'}
    </button>
    <button
      type="button"
      class="btn remove-btn danger-btn"
      onclick={() => onRequestDelete(entry)}
      aria-label="delete"
    >
      ×
    </button>
  </p>
  {#if entry.excluded}<p class="warn">excluded</p>{/if}
</article>

<style>
  .card {
    border: 1px solid var(--border);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .card.excluded {
    opacity: 0.5;
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
  .actions {
    display: flex;
    align-items: center;
    gap: 0.5ch;
    margin: 0.25rem 0 0;
  }
  .exclude-btn {
    flex: 1;
    min-width: 0;
  }
  .remove-btn {
    flex: 0 0 auto;
    font-size: 1.2em;
    line-height: 1;
    padding: 0.2em 0.6em;
  }
  .danger-btn:hover,
  .danger-btn:focus-visible {
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
