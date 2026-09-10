<script lang="ts">
  import type { Contestant, Match } from '../lib/types.js';
  import Stage from './Stage.svelte';

  let {
    match,
    contestants,
    progressLabel,
    onDecide
  }: {
    match: Match | null;
    contestants: Contestant[];
    progressLabel?: string;
    onDecide: (side: 'a' | 'b') => void;
  } = $props();

  function byId(id: string | null): Contestant | null {
    if (!id) return null;
    return contestants.find((c) => c.id === id) ?? null;
  }

  let contestantA = $derived(match ? byId(match.a) : null);
  let contestantB = $derived(match ? byId(match.b) : null);
</script>

<section class="panel" id="current-match-panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>current match<span class="bracket" aria-hidden="true"> ]</span></h2>
  {#if progressLabel}<p class="dim progress">{progressLabel}</p>{/if}

  <!-- Exactly what's on the projector right now — title/break slide,
       the current match, or the full bracket, same caption and border
       guide — not forced to the match view, since the presenter may be
       showing the bracket between rounds while still lining up matches. -->
  <div class="preview-frame">
    <Stage />
  </div>

  {#if !match}
    <p class="dim no-match">no match selected</p>
  {:else}
    <div class="decide-row">
      <button type="button" class="btn primary" onclick={() => onDecide('a')} disabled={match.winnerId !== null}>
        <span class="key" aria-hidden="true">[←]</span> {contestantA?.title || contestantA?.filename || 'left'} wins
      </button>
      <button type="button" class="btn primary" onclick={() => onDecide('b')} disabled={match.winnerId !== null}>
        {contestantB?.title || contestantB?.filename || 'right'} wins <span class="key" aria-hidden="true">[→]</span>
      </button>
    </div>
    <p class="dim nav-hint"><span class="key" aria-hidden="true">[↑/↓]</span> browse matches without deciding</p>
  {/if}
</section>

<style>
  #current-match-panel {
    scroll-margin-top: 2rem;
  }
  .preview-frame {
    position: relative;
    background: #000;
    border: 1px solid var(--border);
    height: min(48vh, 30rem);
    margin-top: 1rem;
  }
  .progress {
    margin-top: 0.5rem;
  }
  .no-match {
    margin-top: 0.75rem;
  }
  .decide-row {
    margin-top: 1rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .decide-row .btn {
    flex: 1 1 12rem;
  }
  .nav-hint {
    margin-top: 0.75rem;
  }
</style>
