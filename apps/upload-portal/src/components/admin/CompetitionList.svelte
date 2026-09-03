<script lang="ts">
  import { ConfirmModal } from '@wdps/shared-ui';
  import type { Competition } from '../../lib/types.js';
  import { createCompetition, lockCompetition, deleteCompetition } from '../../lib/api/client.js';

  let {
    competitions,
    onChanged,
    onOpen
  }: {
    competitions: Competition[];
    onChanged: () => void;
    onOpen: (c: Competition) => void;
  } = $props();

  let newName = $state('');
  let creating = $state(false);
  let error = $state('');
  let pendingDelete = $state<Competition | null>(null);

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    creating = true;
    error = '';
    try {
      await createCompetition(newName.trim());
      newName = '';
      onChanged();
    } catch (err) {
      error = err instanceof Error ? err.message : 'failed to create competition';
    } finally {
      creating = false;
    }
  }

  async function lock(c: Competition) {
    await lockCompetition(c.id);
    onChanged();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteCompetition(pendingDelete.id);
    pendingDelete = null;
    onChanged();
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>new competition<span class="bracket" aria-hidden="true"> ]</span></h2>
  <form class="new-form" onsubmit={create}>
    <input type="text" bind:value={newName} placeholder="competition name" />
    <button type="submit" class="btn primary" disabled={creating || !newName.trim()}>create</button>
  </form>
  {#if error}<p class="danger">{error}</p>{/if}
</section>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>competitions<span class="bracket" aria-hidden="true"> ]</span></h2>
  {#if competitions.length === 0}
    <p class="dim">none yet.</p>
  {:else}
    <ul class="competition-list">
      {#each competitions as c}
        <li>
          <button type="button" class="btn open-btn" onclick={() => onOpen(c)}>{c.name}</button>
          <span class="dim">{c.entryCount} entr{c.entryCount === 1 ? 'y' : 'ies'} · {c.status}</span>
          {#if c.status === 'open'}
            <button type="button" class="btn" onclick={() => lock(c)}>lock</button>
          {/if}
          <button type="button" class="btn danger-btn" onclick={() => (pendingDelete = c)}>delete</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#if pendingDelete}
  <ConfirmModal
    message={`Delete "${pendingDelete.name}"? All ${pendingDelete.entryCount} of its entries go with it. This can't be undone.`}
    confirmLabel="delete"
    onConfirm={confirmDelete}
    onCancel={() => (pendingDelete = null)}
  />
{/if}

<style>
  .new-form {
    display: flex;
    gap: 1ch;
    margin-top: 1rem;
    flex-wrap: wrap;
  }
  .new-form input {
    flex: 1;
    min-width: 12rem;
  }
  .competition-list {
    list-style: none;
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .competition-list li {
    display: flex;
    align-items: center;
    gap: 1ch;
    flex-wrap: wrap;
  }
  .open-btn {
    border-color: transparent;
    padding-left: 0;
    color: var(--amber);
  }
  .danger-btn:hover,
  .danger-btn:focus-visible {
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
