<script lang="ts">
  // The full tournament tree — every round rendered at once, "TBD" for
  // slots not yet reached. Pure CSS Grid, no JS coordinate math: round r
  // match i always spans grid rows [i*2^r, i*2^r + 2^r) of a
  // bracketSize-row grid, which self-similarly centers every match
  // exactly between its two feeder matches for free. Sized in cqw/cqh
  // (container-type: inline-size on the root) so the exact same markup
  // works full-screen on the projector or shrunk into a small embedded
  // panel — same trick Stage.svelte uses for the photo/match scenes.
  import type { Contestant, Match } from '../lib/types.js';

  let { matches, contestants }: { matches: Match[]; contestants: Contestant[] } = $props();

  let totalRounds = $derived(matches.reduce((max, m) => Math.max(max, m.round), 0));

  function byId(id: string | null): Contestant | null {
    if (!id) return null;
    return contestants.find((c) => c.id === id) ?? null;
  }

  function label(c: Contestant | null): string {
    if (!c) return '';
    return c.title || c.filename;
  }

  function roundLabel(round: number): string {
    if (round === totalRounds) return 'final';
    if (round === totalRounds - 1) return 'semifinal';
    return `round ${round}`;
  }
</script>

<div class="tree" style:--total-rounds={totalRounds} style:--bracket-size={2 ** totalRounds}>
  {#each Array(totalRounds) as _, i}
    {@const round = i + 1}
    <div class="round-heading" style:grid-column={2 * round - 1}>{roundLabel(round)}</div>
  {/each}

  {#each matches as m (m.id)}
    {@const contestantA = byId(m.a)}
    {@const contestantB = byId(m.b)}
    <div
      class="match"
      style:grid-column={2 * m.round - 1}
      style:grid-row="{m.slot * 2 ** m.round + 2} / span {2 ** m.round}"
    >
      <div class="slot" class:winner={m.winnerId !== null && m.winnerId === m.a} class:loser={m.winnerId !== null && m.winnerId !== m.a}>
        {contestantA ? label(contestantA) : 'TBD'}
      </div>
      <div class="slot" class:winner={m.winnerId !== null && m.winnerId === m.b} class:loser={m.winnerId !== null && m.winnerId !== m.b}>
        {m.bye ? '— bye —' : contestantB ? label(contestantB) : 'TBD'}
      </div>
    </div>
    {#if m.round > 1}
      <!-- One connector per match, not per feeder: `m`'s own row span
           already exactly equals its two feeders' combined span (the
           row-span math is self-similar across rounds), so this single
           elbow correctly joins both feeders into `m` without needing to
           reach for either feeder's span separately. -->
      <div
        class="connector"
        style:grid-column={2 * (m.round - 1)}
        style:grid-row="{m.slot * 2 ** m.round + 2} / span {2 ** m.round}"
      >
        <span class="tick-top"></span>
        <span class="tick-bottom"></span>
        <span class="spine"></span>
        <span class="tick-out"></span>
      </div>
    {/if}
  {/each}

  {#if totalRounds === 0}
    <p class="dim empty">no bracket drawn yet</p>
  {/if}
</div>

<style>
  .tree {
    container-type: inline-size;
    position: relative;
    display: grid;
    grid-template-columns: repeat(calc(var(--total-rounds) * 2 - 1), 1fr);
    grid-template-rows: repeat(calc(var(--bracket-size) + 1), 1fr);
    gap: 0.4cqh 0;
    width: 100%;
    height: 100%;
    padding: 3cqh 1.5cqw;
    box-sizing: border-box;
  }
  .round-heading {
    grid-row: 1;
    text-align: center;
    color: var(--amber);
    font-size: 1.6cqw;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .match {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.3cqh;
    border: 1px solid var(--border);
    padding: 0.5cqh 0.8cqw;
    font-size: 1.4cqw;
    background: var(--bg);
  }
  .slot {
    color: var(--dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .slot.winner {
    color: var(--fg);
    font-weight: bold;
  }
  .slot.loser {
    color: var(--dim);
    text-decoration: line-through;
  }
  .connector {
    position: relative;
  }
  .connector .tick-top,
  .connector .tick-bottom,
  .connector .tick-out {
    position: absolute;
    width: 50%;
    border-top: 1px solid var(--border);
  }
  .connector .tick-top {
    top: 25%;
    left: 0;
  }
  .connector .tick-bottom {
    top: 75%;
    left: 0;
  }
  .connector .tick-out {
    top: 50%;
    left: 50%;
  }
  .connector .spine {
    position: absolute;
    top: 25%;
    bottom: 25%;
    left: 50%;
    border-right: 1px solid var(--border);
  }
  .empty {
    grid-column: 1;
    grid-row: 2;
  }
</style>
