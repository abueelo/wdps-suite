<script lang="ts">
  import { ownerLog } from '../../lib/api/client.js';
  import type { LogEntry } from '../../lib/types.js';

  let entries = $state<LogEntry[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      entries = await ownerLog();
    } catch (err) {
      error = err instanceof Error ? err.message : 'failed to load log';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    load();
  });

  function formatTime(at: number): string {
    return new Date(at).toLocaleString();
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>activity log<span class="bracket" aria-hidden="true"> ]</span></h2>
  <button type="button" class="btn" onclick={load}>refresh</button>
  {#if loading}
    <p class="dim">loading…</p>
  {:else if error}
    <p class="danger">{error}</p>
  {:else if entries.length === 0}
    <p class="dim">nothing logged yet.</p>
  {:else}
    <ul class="log-list">
      {#each entries as entry (entry.id)}
        <li>
          <span class="dim">{formatTime(entry.at)}</span>
          <span class="type">{entry.type}</span>
          {#if entry.detail}<span>{entry.detail}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .log-list {
    list-style: none;
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 24rem;
    overflow-y: auto;
  }
  .log-list li {
    display: flex;
    gap: 1ch;
    flex-wrap: wrap;
    font-size: 0.9em;
  }
  .type {
    color: var(--amber);
  }
</style>
