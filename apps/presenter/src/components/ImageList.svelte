<script lang="ts">
  import type { PresenterImage } from '../lib/types.js';
  import Thumbnail from './Thumbnail.svelte';

  let {
    images,
    currentImageId,
    showHeldOnly,
    onSelect
  }: {
    images: PresenterImage[];
    currentImageId: string | null;
    showHeldOnly: boolean;
    onSelect: (id: string) => void;
  } = $props();

  let visible = $derived(
    [...images].sort((a, b) => a.order - b.order).filter((img) => !showHeldOnly || img.held)
  );
</script>

<ul class="image-list">
  {#each visible as img (img.id)}
    <li>
      <button
        type="button"
        class="row"
        class:current={img.id === currentImageId}
        onclick={() => onSelect(img.id)}
        aria-current={img.id === currentImageId ? 'true' : undefined}
      >
        <Thumbnail blob={img.blob} filename={img.filename} />
        <span class="name">{img.title || img.filename}</span>
        {#if img.photographer}<span class="dim photographer">{img.photographer}</span>{/if}
        <span class="badges">
          {#if img.held}<span class="warn" title="held back">held</span>{/if}
          <span class={img.rating === null ? 'dim' : 'ok'}>{img.rating === null ? '—' : img.rating}</span>
        </span>
      </button>
    </li>
  {:else}
    <li class="dim empty">{showHeldOnly ? 'no held-back images' : 'no images'}</li>
  {/each}
</ul>

<style>
  .image-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-height: 28rem;
    overflow-y: auto;
    overflow-x: hidden;
    margin-top: 0.75rem;
  }
  .row {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.15em 1ch;
    width: 100%;
    text-align: left;
    font: inherit;
    color: var(--fg);
    background: none;
    border: 1px solid transparent;
    padding: 0.3em 0.5em;
    cursor: pointer;
  }
  .row:hover,
  .row:focus-visible {
    border-color: var(--border);
    color: var(--amber);
  }
  .row.current {
    border-color: var(--amber);
    color: var(--amber);
  }
  .name {
    /* Full title, never truncated — the presenter needs to be able to
       read it out as-is, so it wraps onto another line rather than
       hiding anything behind an ellipsis. */
    flex: 1 1 auto;
    min-width: 8ch;
  }
  .photographer {
    flex-shrink: 0;
  }
  .badges {
    display: flex;
    gap: 1ch;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .empty {
    padding: 0.3em 0.5em;
  }
</style>
