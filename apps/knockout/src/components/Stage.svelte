<script lang="ts">
  // The actual "what's on screen" renderer — title/break/match/bracket,
  // border guide, revealed caption with its flash timing. Used by both
  // Display.svelte (the real projector window, full page) and
  // CurrentMatch (a small embedded copy on the control panel), so the
  // control panel is never showing something that merely resembles the
  // projector — it's the exact same component, just in a smaller box.
  //
  // Font sizes below are in cqw/cqh (container query units, relative to
  // this component's own box) rather than vw/vh (relative to the whole
  // browser viewport) specifically so that scaling: a heading that's
  // 4% of the projector's width is also 4% of the small preview box's
  // width, not 4% of the entire control-panel page.
  import { sessionStore } from '../lib/session/store.svelte.js';
  import { blobToDisplayUrl } from '../lib/display/orientation.js';
  import type { Contestant, Match } from '../lib/types.js';
  import BracketTree from './BracketTree.svelte';

  const FLASH_DURATION_MS = 4000;

  let session = $derived(sessionStore.current);

  function contestantById(id: string | null): Contestant | null {
    if (!id) return null;
    return session.contestants.find((c) => c.id === id) ?? null;
  }

  let currentMatch = $derived<Match | null>(session.matches.find((m) => m.id === session.currentMatchId) ?? null);
  let matchReady = $derived(currentMatch !== null && currentMatch.a !== null && currentMatch.b !== null);
  let contestantA = $derived(matchReady ? contestantById(currentMatch!.a) : null);
  let contestantB = $derived(matchReady ? contestantById(currentMatch!.b) : null);

  // Falls back to the scene that's always safe to show: the bracket once
  // one's been drawn (it always has *something* meaningful — the tree
  // with TBD placeholders, even before any match is reachable), or the
  // title slide before that. Unlike presenter, 'match' can't be that
  // fallback — it's legitimately empty between rounds, before any
  // decision, or once the tournament is over.
  function fallback(): 'title' | 'bracket' {
    return session.drawn ? 'bracket' : 'title';
  }
  let activeScene = $derived.by(() => {
    if (session.scene === 'title' && !session.titleSlide.enabled) return fallback();
    if (session.scene === 'break' && !session.breakSlide.enabled) return fallback();
    if (session.scene === 'match' && !matchReady) return fallback();
    if (session.scene === 'bracket' && !session.drawn) return fallback();
    return session.scene;
  });

  let titleImageUrl = $state('');
  $effect(() => {
    const image = session.titleSlide.image;
    let url = '';
    if (image) {
      url = URL.createObjectURL(image);
      titleImageUrl = url;
    } else {
      titleImageUrl = '';
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  let breakImageUrl = $state('');
  $effect(() => {
    const image = session.breakSlide.image;
    let url = '';
    if (image) {
      url = URL.createObjectURL(image);
      breakImageUrl = url;
    } else {
      breakImageUrl = '';
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  let urlA = $state('');
  $effect(() => {
    const c = contestantA;
    let url = '';
    let cancelled = false;
    if (c) {
      blobToDisplayUrl(c.blob, c.filename).then((u) => {
        if (cancelled) return;
        url = u;
        urlA = u;
      });
    } else {
      urlA = '';
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });

  let urlB = $state('');
  $effect(() => {
    const c = contestantB;
    let url = '';
    let cancelled = false;
    if (c) {
      blobToDisplayUrl(c.blob, c.filename).then((u) => {
        if (cancelled) return;
        url = u;
        urlB = u;
      });
    } else {
      urlB = '';
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });

  // In "flash" mode the caption only shows for a few seconds right after
  // switching to a new match, rather than staying up the whole time —
  // re-armed every time currentMatch.id changes.
  let flashVisible = $state(false);
  $effect(() => {
    const id = currentMatch?.id;
    if (!id || !session.revealFlashOnly) {
      flashVisible = false;
      return;
    }
    flashVisible = true;
    const timer = setTimeout(() => {
      flashVisible = false;
    }, FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  });

  let captionShown = $derived(
    (session.revealTitle || session.revealPhotographer) && (session.revealFlashOnly ? flashVisible : true)
  );

  function caption(c: Contestant | null): string {
    if (!c) return '';
    const parts: string[] = [];
    if (session.revealTitle) parts.push(c.title || '(untitled)');
    if (session.revealPhotographer && c.photographer) parts.push(c.photographer);
    return parts.join(' — ');
  }
</script>

<div class="stage">
  {#if activeScene === 'title'}
    {#if titleImageUrl}
      <img class="frame" class:bordered={session.borderGuide} src={titleImageUrl} alt="" />
    {:else}
      <p class="heading">{session.titleSlide.heading || 'wdps'}</p>
    {/if}
  {:else if activeScene === 'break'}
    {#if breakImageUrl}
      <img class="frame" class:bordered={session.borderGuide} src={breakImageUrl} alt="" />
    {:else}
      <p class="heading dim">back shortly</p>
    {/if}
  {:else if activeScene === 'match' && matchReady}
    <div class="vs">
      <div class="pane">
        <img class="frame" class:bordered={session.borderGuide} src={urlA} alt="" />
        {#if captionShown}<p class="caption">{caption(contestantA)}</p>{/if}
      </div>
      <div class="divider">VS</div>
      <div class="pane">
        <img class="frame" class:bordered={session.borderGuide} src={urlB} alt="" />
        {#if captionShown}<p class="caption">{caption(contestantB)}</p>{/if}
      </div>
    </div>
  {:else if activeScene === 'bracket'}
    <BracketTree matches={session.matches} contestants={session.contestants} />
  {:else}
    <p class="heading dim">nothing to show yet</p>
  {/if}
</div>

<style>
  .stage {
    container-type: inline-size;
    position: absolute;
    inset: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .frame {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .frame.bordered {
    outline: 3px solid #fff;
    outline-offset: -3px;
  }
  .heading {
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    color: #c9a25e;
    font-size: 4cqw;
    letter-spacing: 0.1em;
    text-align: center;
    padding: 0 2cqw;
  }
  .heading.dim {
    color: #6e6b60;
  }
  .vs {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }
  .pane {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .divider {
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    color: #c9a25e;
    font-size: 3cqw;
    font-weight: bold;
    letter-spacing: 0.1em;
    padding: 0 2cqw;
  }
  .caption {
    position: absolute;
    left: 50%;
    bottom: 4cqh;
    transform: translateX(-50%);
    background: #000;
    color: #fff;
    padding: 0.5em 1em;
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 1.3cqw;
    white-space: nowrap;
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
