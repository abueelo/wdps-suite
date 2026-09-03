<script lang="ts">
  import type { Competition } from '../../lib/types.js';

  let { competitions, onPick }: { competitions: Competition[]; onPick: (c: Competition) => void } = $props();
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>pick a competition<span class="bracket" aria-hidden="true"> ]</span></h2>
  {#if competitions.length === 0}
    <p class="dim">no competitions are open for entries right now.</p>
  {:else}
    <ul class="competition-list">
      {#each competitions as c}
        <li>
          <button type="button" class="btn" onclick={() => onPick(c)}>{c.name}</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
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
  }
</style>
