<script lang="ts">
  import { ConfirmModal } from '@wdps/shared-ui';
  import type { Contestant } from '../lib/types.js';
  import Thumbnail from './Thumbnail.svelte';

  let {
    contestants,
    onRemove
  }: {
    contestants: Contestant[];
    onRemove: (id: string) => void;
  } = $props();

  let visible = $derived([...contestants].sort((a, b) => a.order - b.order));

  let pendingRemove = $state<Contestant | null>(null);

  function confirmRemove() {
    if (!pendingRemove) return;
    onRemove(pendingRemove.id);
    pendingRemove = null;
  }
</script>

<ul class="contestant-list">
  {#each visible as c (c.id)}
    <li class="row">
      <Thumbnail blob={c.blob} filename={c.filename} />
      <span class="name">{c.title || c.filename}</span>
      {#if c.photographer}<span class="dim photographer">{c.photographer}</span>{/if}
      <button type="button" class="btn danger" onclick={() => (pendingRemove = c)}>remove</button>
    </li>
  {:else}
    <li class="dim empty">no contestants yet</li>
  {/each}
</ul>

{#if pendingRemove}
  <ConfirmModal
    message={`remove "${pendingRemove.title || pendingRemove.filename}" from the draw? this can't be undone.`}
    confirmLabel="remove"
    onConfirm={confirmRemove}
    onCancel={() => (pendingRemove = null)}
  />
{/if}

<style>
  .contestant-list {
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
    align-items: center;
    flex-wrap: wrap;
    gap: 0.15em 1ch;
    width: 100%;
    padding: 0.3em 0.5em;
    border: 1px solid transparent;
  }
  .name {
    flex: 1 1 auto;
    min-width: 8ch;
  }
  .photographer {
    flex-shrink: 0;
  }
  .empty {
    padding: 0.3em 0.5em;
  }
</style>
