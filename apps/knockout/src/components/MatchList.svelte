<script lang="ts">
  import type { Contestant, Match } from '../lib/types.js';

  let {
    matches,
    contestants,
    currentMatchId,
    onSelect
  }: {
    matches: Match[];
    contestants: Contestant[];
    currentMatchId: string | null;
    onSelect: (id: string) => void;
  } = $props();

  let totalRounds = $derived(matches.reduce((max, m) => Math.max(max, m.round), 0));

  let rounds = $derived.by(() => {
    const byRound = new Map<number, Match[]>();
    for (const m of matches) {
      const list = byRound.get(m.round) ?? [];
      list.push(m);
      byRound.set(m.round, list);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({ round, matches: list.sort((a, b) => a.slot - b.slot) }));
  });

  function label(round: number): string {
    if (round === totalRounds) return 'final';
    if (round === totalRounds - 1) return 'semifinal';
    return `round ${round}`;
  }

  function byId(id: string | null): Contestant | null {
    if (!id) return null;
    return contestants.find((c) => c.id === id) ?? null;
  }

  function name(c: Contestant | null): string {
    return c ? c.title || c.filename : 'TBD';
  }
</script>

<div class="match-list">
  {#each rounds as { round, matches: roundMatches } (round)}
    <p class="round-heading dim">{label(round)}</p>
    <ul>
      {#each roundMatches as m (m.id)}
        {@const ready = m.a !== null && m.b !== null}
        {@const contestantA = byId(m.a)}
        {@const contestantB = byId(m.b)}
        <li>
          <button
            type="button"
            class="row"
            class:current={m.id === currentMatchId}
            class:decided={m.winnerId !== null}
            disabled={!ready}
            onclick={() => onSelect(m.id)}
          >
            <span class="slot" class:winner={m.winnerId !== null && m.winnerId === m.a}>{name(contestantA)}</span>
            <span class="vs dim">{m.bye ? 'bye' : 'vs'}</span>
            <span class="slot" class:winner={m.winnerId !== null && m.winnerId === m.b}>{m.bye ? '—' : name(contestantB)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="dim empty">no bracket drawn yet</p>
  {/each}
</div>

<style>
  .match-list {
    max-height: 32rem;
    overflow-y: auto;
    margin-top: 0.75rem;
  }
  .round-heading {
    margin-top: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.85em;
  }
  .round-heading:first-child {
    margin-top: 0;
  }
  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin-top: 0.4rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.6ch;
    width: 100%;
    text-align: left;
    font: inherit;
    color: var(--fg);
    background: none;
    border: 1px solid transparent;
    padding: 0.3em 0.5em;
    cursor: pointer;
  }
  .row:disabled {
    cursor: default;
    color: var(--dim);
  }
  .row:not(:disabled):hover,
  .row:not(:disabled):focus-visible {
    border-color: var(--border);
    color: var(--amber);
  }
  .row.current {
    border-color: var(--amber);
    color: var(--amber);
  }
  .row.decided {
    opacity: 0.75;
  }
  .slot {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .slot.winner {
    font-weight: bold;
    opacity: 1;
  }
  .vs {
    flex-shrink: 0;
  }
  .empty {
    padding: 0.3em 0.5em;
  }
</style>
