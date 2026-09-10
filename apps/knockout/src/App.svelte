<script lang="ts">
  import { Divider, ThemeToggle, ConfirmModal } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { sessionStore } from './lib/session/store.svelte.js';
  import { clearSession as clearStoredSession } from './lib/session/db.js';
  import { checkOwnerAuth, ownerLogout } from './lib/auth/ownerAuth.js';
  import { openDisplayWindow, detectExternalScreens, type ScreenChoice } from './lib/display/secondScreen.js';
  import { buildBracket } from './lib/bracket/build.js';
  import { recordWinner, getChampion, firstReachableUndecidedMatch } from './lib/bracket/resolve.js';
  import { emptySession } from './lib/types.js';
  import type { Contestant, LiveSession, Match, SlideConfig, Scene } from './lib/types.js';
  import AuthGate from './components/AuthGate.svelte';
  import DrawScreen from './components/DrawScreen.svelte';
  import MatchList from './components/MatchList.svelte';
  import CurrentMatch from './components/CurrentMatch.svelte';
  import SlideEditor from './components/SlideEditor.svelte';
  import DisplaySettingsPanel from './components/DisplaySettingsPanel.svelte';
  import ExportPanel from './components/ExportPanel.svelte';
  import BracketTree from './components/BracketTree.svelte';

  let authState = $state<'loading' | 'in' | 'out'>('loading');
  checkOwnerAuth().then((ok) => {
    authState = ok ? 'in' : 'out';
  });

  let displayStatus = $state('');
  let presenting = $state(false);
  let displayWindowRef: Window | null = null;
  let screenChoices = $state<ScreenChoice[]>([]);
  let screensChecked = $state(false);
  let selectedScreenIndex = $state(0);
  let exportPanelRef = $state<{ saveProject: () => Promise<void> } | undefined>(undefined);
  let confirmClear = $state(false);
  let confirmRedraw = $state(false);

  let session = $derived(sessionStore.current);
  let currentMatch = $derived<Match | null>(session.matches.find((m) => m.id === session.currentMatchId) ?? null);
  let champion = $derived(getChampion(session.matches));
  let decidedCount = $derived(session.matches.filter((m) => m.winnerId !== null && !m.bye).length);
  let totalRealMatches = $derived(session.matches.filter((m) => !m.bye).length);
  let progressLabel = $derived(session.drawn ? `${decidedCount} / ${totalRealMatches} matches decided` : '');

  // Distinct upload-portal imports currently in the session, so a wrong
  // or duplicate one can be pulled back out on its own — locally added
  // files aren't tagged with a batch, so they're never listed here.
  let importBatches = $derived.by(() => {
    const byId = new Map<string, { id: string; label: string; count: number }>();
    for (const c of session.contestants) {
      if (!c.importBatch) continue;
      const existing = byId.get(c.importBatch.id);
      if (existing) existing.count++;
      else byId.set(c.importBatch.id, { ...c.importBatch, count: 1 });
    }
    return [...byId.values()];
  });

  function onContestantsReady(contestants: Contestant[]) {
    void sessionStore.update((s) => {
      const startOrder = s.contestants.length;
      const withOrder = contestants.map((c, i) => ({ ...c, order: startOrder + i }));
      s.contestants.push(...withOrder);
    });
  }

  function onRemoveContestant(id: string) {
    void sessionStore.update((s) => {
      s.contestants = s.contestants.filter((c) => c.id !== id);
    });
  }

  function onRemoveImportBatch(batchId: string) {
    void sessionStore.update((s) => {
      s.contestants = s.contestants.filter((c) => c.importBatch?.id !== batchId);
    });
  }

  async function onProjectImported(next: LiveSession) {
    await sessionStore.replace(next);
  }

  function hasRealDecision(): boolean {
    return session.matches.some((m) => m.winnerId !== null && !m.bye);
  }

  function performDraw() {
    void sessionStore.update((s) => {
      s.matches = buildBracket(s.contestants.map((c) => c.id));
      s.drawn = true;
      s.currentMatchId = firstReachableUndecidedMatch(s.matches)?.id ?? null;
      s.scene = 'match';
    });
    confirmRedraw = false;
  }

  // Drawing fresh (nothing to lose) happens immediately; re-drawing an
  // already-running bracket needs confirmation once any real (non-bye)
  // match has a winner — byes don't count, since they auto-resolve the
  // instant a bracket is drawn and would otherwise make "freely redraw"
  // impossible for the common non-power-of-two case.
  function handleDrawKey() {
    if (!session.drawn || !hasRealDecision()) {
      performDraw();
    } else {
      confirmRedraw = true;
    }
  }

  function selectMatch(id: string) {
    void sessionStore.update((s) => {
      s.currentMatchId = id;
      s.scene = 'match';
    });
  }

  function reachableMatches(): Match[] {
    return [...session.matches].filter((m) => m.a !== null && m.b !== null).sort((a, b) => a.round - b.round || a.slot - b.slot);
  }

  function browseMatch(delta: number) {
    const list = reachableMatches();
    if (list.length === 0) return;
    const idx = list.findIndex((m) => m.id === session.currentMatchId);
    const next = list[(idx + delta + list.length) % list.length] ?? list[0];
    selectMatch(next.id);
  }

  function decideCurrentMatch(side: 'a' | 'b') {
    const match = currentMatch;
    if (!match || match.winnerId !== null) return;
    const winnerId = side === 'a' ? match.a : match.b;
    if (!winnerId) return;
    void sessionStore.update((s) => {
      s.matches = recordWinner(s.matches, match.id, winnerId);
      const champ = getChampion(s.matches);
      if (champ) {
        s.scene = 'bracket';
        s.currentMatchId = null;
      } else {
        s.currentMatchId = firstReachableUndecidedMatch(s.matches)?.id ?? null;
      }
    });
  }

  function setScene(scene: Scene) {
    void sessionStore.update((s) => {
      s.scene = scene;
    });
  }

  // Pressing the same slide's key/button twice is "show it, then put it
  // away again" — flips back to whatever's currently reachable (match if
  // drawn, else title) rather than sitting on the slide with no easy way
  // back.
  function toggleScene(scene: 'title' | 'break') {
    void sessionStore.update((s) => {
      s.scene = s.scene === scene ? (s.drawn ? 'match' : 'title') : scene;
    });
  }

  function updateSlide(which: 'titleSlide' | 'breakSlide', patch: Partial<SlideConfig>) {
    void sessionStore.update((s) => {
      Object.assign(s[which], patch);
    });
  }

  function toggleRevealTitle() {
    void sessionStore.update((s) => {
      s.revealTitle = !s.revealTitle;
    });
  }

  function toggleRevealPhotographer() {
    void sessionStore.update((s) => {
      s.revealPhotographer = !s.revealPhotographer;
    });
  }

  function toggleRevealFlashOnly() {
    void sessionStore.update((s) => {
      s.revealFlashOnly = !s.revealFlashOnly;
    });
  }

  function toggleBorder() {
    void sessionStore.update((s) => {
      s.borderGuide = !s.borderGuide;
    });
  }

  // First click: if there's more than one candidate external screen,
  // just lists them (via a user-gesture-gated permission check) and
  // waits for a choice rather than guessing — otherwise it's unambiguous
  // and opens straight away. Second click (once presenting) stops.
  async function handlePresentClick() {
    if (presenting) {
      displayWindowRef?.close();
      displayWindowRef = null;
      presenting = false;
      displayStatus = '';
      return;
    }

    if (!screensChecked) {
      screenChoices = await detectExternalScreens();
      screensChecked = true;
      if (screenChoices.length > 1) return; // presenter picks one, then clicks present again
    }

    try {
      const chosen = screenChoices[selectedScreenIndex];
      const result = await openDisplayWindow('/knockout/display.html', chosen?.screen);
      displayWindowRef = result.window;
      presenting = true;
      document.getElementById('scene-row')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      displayStatus =
        result.mode === 'auto'
          ? `presenting on ${chosen ? chosen.label : 'the second screen'}.`
          : 'display window opened — drag it to the projector and press F11 to fullscreen it.';
    } catch (err) {
      displayStatus = err instanceof Error ? err.message : 'could not open the display window';
    }
  }

  // Notices if the display window was closed some other way (its own
  // close button, alt-F4, ...) so "present" doesn't stay stuck saying
  // "stop presenting" for a window that's already gone.
  $effect(() => {
    if (!presenting) return;
    const interval = setInterval(() => {
      if (displayWindowRef?.closed) {
        displayWindowRef = null;
        presenting = false;
        displayStatus = '';
      }
    }, 1000);
    return () => clearInterval(interval);
  });

  async function clearSession() {
    await sessionStore.replace(emptySession());
    confirmClear = false;
  }

  // Leaving the tool entirely should take the projector output down with
  // it — otherwise the display window is left open showing whatever was
  // last on it, orphaned from a control panel that's no longer running.
  function goHome() {
    displayWindowRef?.close();
    window.location.href = '/';
  }

  async function logout() {
    displayWindowRef?.close();
    await ownerLogout();
    authState = 'out';
  }

  // Warns before leaving the page at all — closing/refreshing the tab,
  // or clicking the [h] home link, which is just a same-tab navigation
  // and triggers this the same way. This is what gives someone the
  // chance to cancel and go export a project file first.
  $effect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (session.contestants.length === 0) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });

  // Once the page is actually being torn down (the warning above was
  // confirmed, or there was nothing to warn about), wipe the stored
  // session rather than leaving competition photos sitting in this
  // browser indefinitely. pagehide only fires on a real unload — never
  // while the beforeunload prompt is still up letting someone cancel.
  $effect(() => {
    function handler() {
      void clearStoredSession();
    }
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  });

  $effect(() => {
    return bindShortcuts({
      t: () => document.getElementById('theme-toggle')?.click(),
      h: goHome,
      x: () => {
        if (authState === 'in') void logout();
      },
      p: () => {
        void handlePresentClick();
      },
      s: () => {
        void exportPanelRef?.saveProject();
      },
      i: () => toggleScene('title'),
      b: () => toggleScene('break'),
      m: () => setScene('match'),
      j: () => setScene('bracket'),
      v: () => toggleRevealTitle(),
      c: () => toggleRevealPhotographer(),
      q: () => toggleRevealFlashOnly(),
      w: () => toggleBorder(),
      d: () => handleDrawKey(),
      g: () => {
        if (champion) setScene('bracket');
      },
      ArrowLeft: () => decideCurrentMatch('a'),
      ArrowRight: () => decideCurrentMatch('b'),
      ArrowUp: () => browseMatch(-1),
      ArrowDown: () => browseMatch(1)
    });
  });
</script>

<div class="page">
  <header class="suite-header">
    <pre class="name" aria-hidden="true" style="--banner-cols: 30;">█▄▀ █▄ █ █▀█ █▀▀ █▄▀ █▀█ █ █ ▀█▀
█ █ █ ▀█ █▄█ █▄▄ █ █ █▄█ █▄█  █ </pre>
    <h1 class="visually-hidden">knockout</h1>
    <div class="head-row">
      <p class="tagline dim">run the tournament<span class="cursor" aria-hidden="true">█</span></p>
      <nav class="bracket-nav" aria-label="theme and suite">
        <a href="/" onclick={() => displayWindowRef?.close()}><span class="key" aria-hidden="true">[h]</span> wdps</a>
        {#if authState === 'in'}
          <button type="button" onclick={() => void logout()}><span class="key" aria-hidden="true">[x]</span> log out</button>
        {/if}
        <ThemeToggle />
      </nav>
    </div>
  </header>

  {#if authState === 'loading' || (authState === 'in' && !sessionStore.ready)}
    <p class="dim">loading…</p>
  {:else if authState === 'out'}
    <AuthGate />
  {:else}
    <p class="warn dev-note">[ under development ]</p>

    <div class="present-row">
      <button type="button" class="btn primary present-btn" class:danger={presenting} onclick={() => void handlePresentClick()}>
        <span class="key" aria-hidden="true">[p]</span> {presenting ? 'stop presenting' : 'present'}
      </button>
      {#if screensChecked && screenChoices.length > 1 && !presenting}
        <select bind:value={selectedScreenIndex} aria-label="which screen to present on">
          {#each screenChoices as choice, i}
            <option value={i}>{choice.label}</option>
          {/each}
        </select>
      {/if}
      {#if displayStatus}<span class="dim">{displayStatus}</span>{/if}
    </div>

    <div class="scene-row" id="scene-row">
      <button type="button" class="btn" class:primary={session.scene === 'title'} disabled={!session.titleSlide.enabled} onclick={() => toggleScene('title')}>
        <span class="key" aria-hidden="true">[i]</span> title slide
      </button>
      <button type="button" class="btn" class:primary={session.scene === 'break'} disabled={!session.breakSlide.enabled} onclick={() => toggleScene('break')}>
        <span class="key" aria-hidden="true">[b]</span> break slide
      </button>
      <button type="button" class="btn" class:primary={session.scene === 'match'} disabled={!session.drawn} onclick={() => setScene('match')}>
        <span class="key" aria-hidden="true">[m]</span> current match
      </button>
      <button type="button" class="btn" class:primary={session.scene === 'bracket'} disabled={!session.drawn} onclick={() => setScene('bracket')}>
        <span class="key" aria-hidden="true">[j]</span> full bracket
      </button>
      <button type="button" class="btn" disabled={!champion} onclick={() => setScene('bracket')}>
        <span class="key" aria-hidden="true">[g]</span> show champion
      </button>
    </div>

    {#snippet slidesDetails()}
      <details class="panel">
        <summary><span class="bracket" aria-hidden="true">[ </span>slides<span class="bracket" aria-hidden="true"> ]</span></summary>
        <SlideEditor
          label="title slide"
          slide={session.titleSlide}
          showHeading={true}
          active={session.scene === 'title'}
          showKey="i"
          onUpdate={(p) => updateSlide('titleSlide', p)}
          onShowNow={() => toggleScene('title')}
        />
        <Divider />
        <SlideEditor
          label="break slide"
          slide={session.breakSlide}
          active={session.scene === 'break'}
          showKey="b"
          onUpdate={(p) => updateSlide('breakSlide', p)}
          onShowNow={() => toggleScene('break')}
        />
      </details>
    {/snippet}

    {#if !session.drawn}
      <DrawScreen
        contestants={session.contestants}
        {onContestantsReady}
        {onProjectImported}
        {onRemoveContestant}
        {onRemoveImportBatch}
        onDraw={handleDrawKey}
      />
      {@render slidesDetails()}
      <DisplaySettingsPanel
        revealTitle={session.revealTitle}
        revealPhotographer={session.revealPhotographer}
        revealFlashOnly={session.revealFlashOnly}
        borderGuide={session.borderGuide}
        onToggleRevealTitle={toggleRevealTitle}
        onToggleRevealPhotographer={toggleRevealPhotographer}
        onToggleRevealFlashOnly={toggleRevealFlashOnly}
        onToggleBorder={toggleBorder}
      />
    {:else}
      <div class="workspace">
        <div class="col-list">
          <section class="panel">
            <h2><span class="bracket" aria-hidden="true">[ </span>matches<span class="bracket" aria-hidden="true"> ]</span></h2>
            <div class="matches-head">
              <button type="button" class="btn" onclick={handleDrawKey}>
                <span class="key" aria-hidden="true">[d]</span> redraw bracket
              </button>
              <button type="button" class="btn danger clear-btn" onclick={() => (confirmClear = true)}>clear session</button>
            </div>
            <MatchList matches={session.matches} contestants={session.contestants} currentMatchId={session.currentMatchId} onSelect={selectMatch} />
            <p class="dim nav-hint">
              <span class="key" aria-hidden="true">[↑/↓]</span> browse ·
              <span class="key" aria-hidden="true">[←/→]</span> decide the current match
            </p>
          </section>

          <details class="panel bracket-embed">
            <summary><span class="bracket" aria-hidden="true">[ </span>bracket<span class="bracket" aria-hidden="true"> ]</span></summary>
            <div class="bracket-frame">
              <BracketTree matches={session.matches} contestants={session.contestants} />
            </div>
          </details>
        </div>

        <div class="col-main">
          <CurrentMatch match={currentMatch} contestants={session.contestants} {progressLabel} onDecide={decideCurrentMatch} />

          {@render slidesDetails()}

          <DisplaySettingsPanel
            revealTitle={session.revealTitle}
            revealPhotographer={session.revealPhotographer}
            revealFlashOnly={session.revealFlashOnly}
            borderGuide={session.borderGuide}
            onToggleRevealTitle={toggleRevealTitle}
            onToggleRevealPhotographer={toggleRevealPhotographer}
            onToggleRevealFlashOnly={toggleRevealFlashOnly}
            onToggleBorder={toggleBorder}
          />

          <ExportPanel {session} bind:this={exportPanelRef} />
        </div>
      </div>
    {/if}

    {#if confirmClear}
      <ConfirmModal
        message="clear the current session? this can't be undone unless you've saved a project file."
        onConfirm={clearSession}
        onCancel={() => (confirmClear = false)}
      />
    {/if}

    {#if confirmRedraw}
      <ConfirmModal
        message="re-drawing will discard all match results and shuffle a new bracket — continue?"
        onConfirm={performDraw}
        onCancel={() => (confirmRedraw = false)}
      />
    {/if}
  {/if}

  <footer class="suite-footer">
    <p><span aria-hidden="true">☼ </span><a class="edit-link" href="/upload-portal/owner.html"><span class="swap">abueelo</span></a> · <span id="year">1970</span><span aria-hidden="true"> ☼</span></p>
  </footer>
</div>

<style>
  .tagline {
    margin-top: 0.75rem;
  }
  .dev-note {
    margin-top: 1.5rem;
  }
  .present-row {
    margin-top: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .present-btn.danger {
    border-color: var(--danger);
    color: var(--danger);
  }
  .present-btn.danger:hover,
  .present-btn.danger:focus-visible {
    background: var(--danger);
    color: var(--bg);
  }
  .scene-row {
    margin-top: 1rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .workspace {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .col-list {
    flex: 0 1 20rem;
    min-width: 16rem;
  }
  .col-main {
    flex: 1 1 28rem;
    min-width: 0;
  }
  .matches-head {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .clear-btn {
    border-color: var(--danger);
  }
  .clear-btn:hover,
  .clear-btn:focus-visible {
    background: var(--danger);
    color: var(--bg);
  }
  .nav-hint {
    margin-top: 0.75rem;
  }
  .bracket-embed {
    margin-top: 2.75rem;
  }
  .bracket-frame {
    position: relative;
    background: #000;
    border: 1px solid var(--border);
    height: 22rem;
    margin-top: 1rem;
  }
</style>
