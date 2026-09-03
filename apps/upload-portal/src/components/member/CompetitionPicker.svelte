<script lang="ts">
  import type { Competition } from '../../lib/types.js';

  let { competitions, onPick }: { competitions: Competition[]; onPick: (c: Competition) => void } = $props();
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>pick a competition<span class="bracket" aria-hidden="true"> ]</span></h2>
  {#if competitions.length === 0}
    <p class="dim">no competitions yet.</p>
  {:else}
    <ul class="competition-list">
      {#each competitions as c}
        <li>
          {#if c.status === 'open'}
            <button type="button" class="btn" onclick={() => onPick(c)}>{c.name}</button>
          {:else}
            <span class="btn closed" aria-disabled="true">{c.name} <span class="dim">— closed for entry</span></span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  /* this panel is just a list of buttons — the whole-box hover highlight
     every other panel in the suite uses reads as too much here, each row
     already gets its own hover feedback. */
  section.panel:hover {
    border-color: var(--border);
  }
  .competition-list {
    list-style: none;
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .competition-list .btn {
    width: 100%;
    text-align: left;
    display: block;
  }
  .closed {
    cursor: default;
    opacity: 0.6;
  }
  .closed:hover {
    border-color: var(--border);
    color: var(--fg);
  }
</style>
