<script lang="ts">
  // The full tournament tree, drawn like a real bracket poster: the left
  // half of the draw runs left-to-right into a semifinalist, the right
  // half runs right-to-left into its own semifinalist (a mirror image of
  // the left), and the final sits by itself in the middle column, fed
  // from both sides. Every match still lays out with pure CSS Grid, no
  // JS coordinate math beyond picking which column/row-span a match
  // belongs to — round r on either side spans grid rows
  // [slot*2^r, slot*2^r + 2^r) of a (bracketSize/2)-row grid (each side
  // only ever holds half the leaves), which self-similarly centers every
  // match between its two feeders for free, same trick as the original
  // single-direction layout. Sized in cqw/cqh (container-type: inline-size
  // on the root) so the same markup works full-screen on the projector or
  // shrunk into a small embedded panel — same trick Stage.svelte uses for
  // the title/match scenes.
  import type { Contestant, Match } from '../lib/types.js';

  let { matches, contestants }: { matches: Match[]; contestants: Contestant[] } = $props();

  let totalRounds = $derived(matches.reduce((max, m) => Math.max(max, m.round), 0));
  let bracketSize = $derived(totalRounds > 0 ? 2 ** totalRounds : 0);

  interface PositionedMatch {
    match: Match;
    column: number;
    rowStart: number;
    rowSpan: number;
  }
  interface PositionedConnector {
    column: number;
    rowStart: number;
    rowSpan: number;
    mirrored: boolean;
  }
  interface Heading {
    column: number;
    label: string;
  }

  function roundLabel(r: number, T: number): string {
    if (r === T) return 'final';
    if (r === T - 1) return 'semifinal';
    return `round ${r}`;
  }

  // +1 baked into every row value below reserves grid row 1 for the
  // round headings, same as the original layout's "+2" offset (the extra
  // +1 there is just the usual 0-indexed-slot -> 1-indexed-grid-row shift).
  let layout = $derived.by(() => {
    const T = totalRounds;
    if (T === 0) return { columns: 0, rows: 0, matches: [] as PositionedMatch[], connectors: [] as PositionedConnector[], headings: [] as Heading[] };

    const halfRows = bracketSize / 2;
    const finalCol = 2 * T - 1;
    const mirror = (col: number) => 2 * finalCol - col;

    const positioned: PositionedMatch[] = [];
    const connectors: PositionedConnector[] = [];
    const headings: Heading[] = [];

    for (const m of matches) {
      if (m.round === T) continue; // the final is placed separately, below
      const matchesInRound = bracketSize / 2 ** m.round;
      const half = matchesInRound / 2;
      const onRight = m.slot >= half;
      const localSlot = onRight ? m.slot - half : m.slot;
      const rowStart = localSlot * 2 ** m.round + 2;
      const rowSpan = 2 ** m.round;
      const leftCol = 2 * m.round - 1;
      const column = onRight ? mirror(leftCol) : leftCol;
      positioned.push({ match: m, column, rowStart, rowSpan });

      if (m.round > 1) {
        const leftConnCol = leftCol - 1;
        connectors.push({ column: onRight ? mirror(leftConnCol) : leftConnCol, rowStart, rowSpan, mirrored: onRight });
      }
    }

    for (let r = 1; r <= T - 1; r++) {
      const leftCol = 2 * r - 1;
      const label = roundLabel(r, T);
      headings.push({ column: leftCol, label });
      headings.push({ column: mirror(leftCol), label });
    }
    headings.push({ column: finalCol, label: 'final' });

    const final = matches.find((m) => m.round === T);
    if (final) positioned.push({ match: final, column: finalCol, rowStart: 2, rowSpan: halfRows });

    // The two connectors feeding the final itself, one from each side's
    // semifinalist — these don't fit the per-round loop above since they
    // cross from a same-side match into the final, not into another
    // same-side match. Only exist once there's an actual semifinal (T>=2).
    if (T >= 2) {
      const semiRowSpan = 2 ** (T - 1); // = halfRows: the semifinal is the only match on its side, so it already spans the full height
      connectors.push({ column: finalCol - 1, rowStart: 2, rowSpan: semiRowSpan, mirrored: false });
      connectors.push({ column: finalCol + 1, rowStart: 2, rowSpan: semiRowSpan, mirrored: true });
    }

    return { columns: 2 * finalCol - 1, rows: halfRows + 1, matches: positioned, connectors, headings };
  });

  function byId(id: string | null): Contestant | null {
    if (!id) return null;
    return contestants.find((c) => c.id === id) ?? null;
  }

  function label(c: Contestant | null): string {
    if (!c) return '';
    return c.title || c.filename;
  }
</script>

<div class="tree" style:--columns={layout.columns} style:--rows={layout.rows}>
  {#each layout.headings as h}
    <div class="round-heading" style:grid-column={h.column}>{h.label}</div>
  {/each}

  {#each layout.matches as { match: m, column, rowStart, rowSpan } (m.id)}
    {@const contestantA = byId(m.a)}
    {@const contestantB = byId(m.b)}
    <div class="match" style:grid-column={column} style:grid-row="{rowStart} / span {rowSpan}">
      <div class="slot" class:winner={m.winnerId !== null && m.winnerId === m.a} class:loser={m.winnerId !== null && m.winnerId !== m.a}>
        {contestantA ? label(contestantA) : 'TBD'}
      </div>
      <div class="slot" class:winner={m.winnerId !== null && m.winnerId === m.b} class:loser={m.winnerId !== null && m.winnerId !== m.b}>
        {m.bye ? '— bye —' : contestantB ? label(contestantB) : 'TBD'}
      </div>
    </div>
  {/each}

  {#each layout.connectors as { column, rowStart, rowSpan, mirrored }}
    <div class="connector" class:mirrored style:grid-column={column} style:grid-row="{rowStart} / span {rowSpan}">
      <span class="tick-top"></span>
      <span class="tick-bottom"></span>
      <span class="spine"></span>
      <span class="tick-out"></span>
    </div>
  {/each}

  {#if totalRounds === 0}
    <p class="empty">no bracket drawn yet</p>
  {/if}
</div>

<style>
  .tree {
    container-type: inline-size;
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(var(--columns), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 0.4cqh 0;
    padding: 2cqh 0.75cqw;
    box-sizing: border-box;
  }
  /* Hardcoded colors, not shared-ui's theme tokens — this component gets
     embedded in two very different documents: the control panel (which
     loads the theme stylesheet) and the bare projector display.html
     (which deliberately doesn't, same as the rest of Stage.svelte). Theme
     vars would just be unset on the projector and render invisible
     black-on-black. */
  .round-heading {
    grid-row: 1;
    text-align: center;
    color: #c9a25e;
    font-size: 1.3cqw;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .match {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.3cqh;
    border: 1px solid #555;
    padding: 0.5cqh 0.7cqw;
    font-size: 1.15cqw;
    background: #000;
  }
  .slot {
    color: #9a9689;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .slot.winner {
    color: #fff;
    font-weight: bold;
  }
  .slot.loser {
    color: #6e6b60;
    text-decoration: line-through;
  }
  .connector {
    position: relative;
  }
  .connector.mirrored {
    transform: scaleX(-1);
  }
  .connector .tick-top,
  .connector .tick-bottom,
  .connector .tick-out {
    position: absolute;
    width: 50%;
    border-top: 1px solid #555;
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
    border-right: 1px solid #555;
  }
  .empty {
    grid-column: 1;
    grid-row: 2;
    color: #6e6b60;
  }
</style>
