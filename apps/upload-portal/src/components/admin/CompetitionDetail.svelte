<script lang="ts">
  import { ConfirmModal } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import type { Competition, Entry } from '../../lib/types.js';
  import { listEntries, lockCompetition, reopenCompetition, setEntryExcluded, deleteEntry } from '../../lib/api/client.js';
  import { downloadCompetitionZip } from '../../lib/export/downloadCompetition.js';
  import { moveToCompSheets } from '../../lib/bus/moveToCompSheets.js';
  import EntryCard from './EntryCard.svelte';

  let { competitionId, onBack }: { competitionId: string; onBack: () => void } = $props();

  let competition = $state<Competition | null>(null);
  let entries = $state<Entry[]>([]);
  let loading = $state(true);
  let error = $state('');
  let busyAction = $state('');
  let pendingDelete = $state<Entry | null>(null);
  let moveResult = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await listEntries(competitionId);
      competition = res.competition;
      entries = res.entries;
    } catch (err) {
      error = err instanceof Error ? err.message : 'failed to load';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });

  let grouped = $derived.by(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = entry.photographer || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });

  async function lock() {
    if (!competition) return;
    busyAction = 'lock';
    try {
      competition = await lockCompetition(competition.id);
    } finally {
      busyAction = '';
    }
  }

  async function unlock() {
    if (!competition) return;
    busyAction = 'lock';
    try {
      competition = await reopenCompetition(competition.id);
    } finally {
      busyAction = '';
    }
  }

  $effect(() => {
    return bindShortcuts({
      l: () => { if (competition?.status === 'open') lock(); else if (competition?.status === 'locked') unlock(); },
      z: () => downloadZip(),
      m: () => { if (competition?.status === 'locked') sendToCompSheets(); }
    });
  });

  async function toggleExcluded(entry: Entry) {
    if (!competition) return;
    const updated = await setEntryExcluded(competition.id, entry.id, !entry.excluded);
    entries = entries.map((e) => (e.id === entry.id ? { ...e, ...updated } : e));
  }

  async function confirmDeleteEntry() {
    if (!competition || !pendingDelete) return;
    await deleteEntry(competition.id, pendingDelete.id);
    entries = entries.filter((e) => e.id !== pendingDelete!.id);
    pendingDelete = null;
  }

  async function downloadZip() {
    if (!competition) return;
    busyAction = 'zip';
    try {
      await downloadCompetitionZip(competition, entries);
    } finally {
      busyAction = '';
    }
  }

  async function sendToCompSheets() {
    if (!competition) return;
    busyAction = 'move';
    moveResult = '';
    try {
      await moveToCompSheets(competition, entries);
      // Straight into comp-sheets with the entries already loaded — no
      // manual import step. See UploadStep.svelte's auto-import effect.
      window.location.href = '/comp-sheets/';
    } catch (err) {
      moveResult = err instanceof Error ? err.message : 'failed to hand off to comp-sheets';
      busyAction = '';
    }
  }
</script>

<button type="button" class="btn back-link" onclick={onBack}>&larr; all competitions</button>

{#if loading}
  <p class="dim">loading…</p>
{:else if error}
  <p class="danger">{error}</p>
{:else if competition}
  <section class="panel">
    <h2><span class="bracket" aria-hidden="true">[ </span>{competition.name}<span class="bracket" aria-hidden="true"> ]</span></h2>
    <p class="dim">{competition.status} · {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</p>
    <p class="actions">
      {#if competition.status === 'open'}
        <button type="button" class="btn" onclick={lock} disabled={busyAction === 'lock'}>
          <span class="key" aria-hidden="true">[l]</span> lock entries
        </button>
      {:else}
        <button type="button" class="btn" onclick={unlock} disabled={busyAction === 'lock'}>
          <span class="key" aria-hidden="true">[l]</span> unlock entries
        </button>
      {/if}
      <button type="button" class="btn" onclick={downloadZip} disabled={busyAction === 'zip' || entries.length === 0}>
        <span class="key" aria-hidden="true">[z]</span> {busyAction === 'zip' ? 'zipping…' : 'download zip'}
      </button>
      <button
        type="button"
        class="btn"
        onclick={sendToCompSheets}
        disabled={competition.status !== 'locked' || busyAction === 'move' || entries.length === 0}
        title={competition.status !== 'locked' ? 'lock entries first' : ''}
      >
        <span class="key" aria-hidden="true">[m]</span> {busyAction === 'move' ? 'sending…' : 'open in comp-sheets'}
      </button>
    </p>
    {#if moveResult}<p class="danger">{moveResult}</p>{/if}
  </section>

  {#if entries.length === 0}
    <p class="dim">no entries yet.</p>
  {:else}
    {#each grouped as [photographer, photographerEntries]}
      <section class="panel">
        <h2><span class="bracket" aria-hidden="true">[ </span>{photographer}<span class="bracket" aria-hidden="true"> ]</span></h2>
        <div class="grid">
          {#each photographerEntries as entry (entry.id)}
            <EntryCard {entry} onToggleExcluded={toggleExcluded} onRequestDelete={(e) => (pendingDelete = e)} />
          {/each}
        </div>
      </section>
    {/each}
  {/if}
{/if}

{#if pendingDelete}
  <ConfirmModal
    message={`Delete "${pendingDelete.title}"? This can't be undone.`}
    confirmLabel="delete"
    onConfirm={confirmDeleteEntry}
    onCancel={() => (pendingDelete = null)}
  />
{/if}

<style>
  .back-link {
    border-color: transparent;
    padding-left: 0;
    margin-bottom: 0.5rem;
  }
  .actions {
    display: flex;
    gap: 1ch;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
</style>
