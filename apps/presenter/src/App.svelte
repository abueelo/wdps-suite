<script lang="ts">
  import { Divider, ThemeToggle, ConfirmModal } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { sessionStore } from './lib/session/store.svelte.js';
  import { clearSession as clearStoredSession } from './lib/session/db.js';
  import { checkOwnerAuth } from './lib/auth/ownerAuth.js';
  import { openDisplayWindow, detectExternalScreens, type ScreenChoice } from './lib/display/secondScreen.js';
  import { emptySession } from './lib/types.js';
  import type { PresenterImage, LiveSession, SlideConfig, Scene } from './lib/types.js';
  import AuthGate from './components/AuthGate.svelte';
  import IntakeScreen from './components/IntakeScreen.svelte';
  import ImageList from './components/ImageList.svelte';
  import PreviewPane from './components/PreviewPane.svelte';
  import SlideEditor from './components/SlideEditor.svelte';
  import DisplaySettingsPanel from './components/DisplaySettingsPanel.svelte';
  import ExportPanel from './components/ExportPanel.svelte';

  let authState = $state<'loading' | 'in' | 'out'>('loading');
  checkOwnerAuth().then((ok) => {
    authState = ok ? 'in' : 'out';
  });

  let showHeldOnly = $state(false);
  let displayStatus = $state('');
  let presenting = $state(false);
  let displayWindowRef: Window | null = null;
  let screenChoices = $state<ScreenChoice[]>([]);
  let screensChecked = $state(false);
  let selectedScreenIndex = $state(0);
  let ratingInputEl = $state<HTMLInputElement | undefined>(undefined);
  let exportPanelRef = $state<{ saveProject: () => Promise<void>; exportResults: () => Promise<void> } | undefined>(undefined);
  let confirmClear = $state(false);

  let session = $derived(sessionStore.current);
  let currentImage = $derived(session.images.find((i) => i.id === session.currentImageId) ?? null);
  let ratedCount = $derived(session.images.filter((i) => i.rating !== null).length);
  let heldCount = $derived(session.images.filter((i) => i.held).length);
  let progressLabel = $derived(
    session.images.length === 0
      ? ''
      : `${ratedCount} / ${session.images.length} rated${heldCount > 0 ? ` · ${heldCount} held back` : ''}`
  );

  function visibleOrdered(): PresenterImage[] {
    return [...session.images].sort((a, b) => a.order - b.order).filter((i) => !showHeldOnly || i.held);
  }

  function selectImage(id: string) {
    void sessionStore.update((s) => {
      s.currentImageId = id;
      s.scene = 'photo';
    });
  }

  function step(delta: number) {
    const list = visibleOrdered();
    if (list.length === 0) return;
    const idx = list.findIndex((i) => i.id === session.currentImageId);
    const next = list[(idx + delta + list.length) % list.length] ?? list[0];
    selectImage(next.id);
  }

  function setRating(rating: number | null) {
    const id = session.currentImageId;
    if (!id) return;
    void sessionStore.update((s) => {
      const img = s.images.find((i) => i.id === id);
      if (img) img.rating = rating;
    });
  }

  // Fires once a typed score is *committed* (Enter or leaving the field) —
  // not on every keystroke, which setRating above already handles for the
  // live display. Advancing on every keystroke would jump to the next
  // image after typing just the "1" of "17".
  function commitRating() {
    const id = session.currentImageId;
    const img = session.images.find((i) => i.id === id);
    if (img?.rating !== null) step(1);
  }

  // A bare digit key, pressed anywhere that isn't already a text field,
  // starts scoring the current image directly — no click or [r] first.
  // It focuses the score field and seeds it with that one digit; every
  // digit after that is just the browser's own native typing in an
  // already-focused input, so "20" works the same way "2" does.
  function startTypingScore(digit: string) {
    const el = ratingInputEl;
    if (!el) return;
    el.focus();
    el.value = digit;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function toggleHold() {
    const id = session.currentImageId;
    if (!id) return;
    let heldNow = false;
    void sessionStore.update((s) => {
      const img = s.images.find((i) => i.id === id);
      if (img) {
        img.held = !img.held;
        heldNow = img.held;
      }
    });
    // Holding one back is "done with this for now" — move on, same as
    // rating does. Un-holding doesn't advance: that happens while
    // reviewing held-back images, and staying put to rate it right there
    // is the more likely next step.
    if (heldNow) step(1);
  }

  function setScene(scene: Scene) {
    void sessionStore.update((s) => {
      s.scene = scene;
    });
  }

  // Pressing the same slide's key/button twice is "show it, then put it
  // away again" — flips back to the current photo rather than just
  // sitting on the slide with no easy way back short of [l].
  function toggleScene(scene: 'title' | 'break') {
    void sessionStore.update((s) => {
      s.scene = s.scene === scene ? 'photo' : scene;
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

  function onImagesReady(images: PresenterImage[]) {
    void sessionStore.update((s) => {
      const startOrder = s.images.length;
      const withOrder = images.map((img, i) => ({ ...img, order: startOrder + i }));
      s.images.push(...withOrder);
      if (!s.currentImageId && withOrder[0]) s.currentImageId = withOrder[0].id;
      s.scene = 'photo';
    });
  }

  async function onProjectImported(next: LiveSession) {
    await sessionStore.replace(next);
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
      const result = await openDisplayWindow('/presenter/display.html', chosen?.screen);
      displayWindowRef = result.window;
      presenting = true;
      // Scroll the control panel down so the preview — the thing you'll
      // be watching while rating, and now a 1:1 copy of the projector —
      // is actually on screen once you're live, rather than left up by
      // the present button.
      document.getElementById('preview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Warns before leaving the page at all — closing/refreshing the tab,
  // or clicking the [h] home link, which is just a same-tab navigation
  // and triggers this the same way. This is what gives someone the
  // chance to cancel and go export a project file first.
  $effect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (session.images.length === 0) return;
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
    const digitShortcuts = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => String(i + 1)).map((digit) => [digit, () => startTypingScore(digit)])
    );
    return bindShortcuts({
      ...digitShortcuts,
      t: () => document.getElementById('theme-toggle')?.click(),
      h: goHome,
      ArrowRight: () => step(1),
      ArrowDown: () => step(1),
      ArrowLeft: () => step(-1),
      ArrowUp: () => step(-1),
      k: () => toggleHold(),
      f: () => (showHeldOnly = !showHeldOnly),
      i: () => toggleScene('title'),
      b: () => toggleScene('break'),
      l: () => setScene('photo'),
      v: () => toggleRevealTitle(),
      c: () => toggleRevealPhotographer(),
      x: () => toggleRevealFlashOnly(),
      w: () => toggleBorder(),
      p: () => {
        void handlePresentClick();
      },
      r: () => ratingInputEl?.focus(),
      s: () => {
        void exportPanelRef?.saveProject();
      },
      e: () => {
        void exportPanelRef?.exportResults();
      }
    });
  });
</script>

<div class="page">
  <header class="suite-header">
    <pre class="name" aria-hidden="true" style="--banner-cols: 25;">█▀█ █▀█ █▀▀ ▄▀▀ █▀▀ █▄█ ▀█▀ █▀▀ █▀█
█▀▀ █▀▄ ██▄ ▄██ ██▄ █▀█  █  ██▄ █▀▄</pre>
    <h1 class="visually-hidden">presenter</h1>
    <div class="head-row">
      <p class="tagline dim">run the competition<span class="cursor" aria-hidden="true">█</span></p>
      <nav class="bracket-nav" aria-label="theme and suite">
        <a href="/" onclick={() => displayWindowRef?.close()}><span class="key" aria-hidden="true">[h]</span> wdps</a>
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

    <div class="scene-row">
      <button type="button" class="btn" class:primary={session.scene === 'title'} disabled={!session.titleSlide.enabled} onclick={() => toggleScene('title')}>
        <span class="key" aria-hidden="true">[i]</span> title slide
      </button>
      <button type="button" class="btn" class:primary={session.scene === 'break'} disabled={!session.breakSlide.enabled} onclick={() => toggleScene('break')}>
        <span class="key" aria-hidden="true">[b]</span> break slide
      </button>
      <button type="button" class="btn" class:primary={session.scene === 'photo'} disabled={session.images.length === 0} onclick={() => setScene('photo')}>
        <span class="key" aria-hidden="true">[l]</span> current image
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

    {#if session.images.length === 0}
      <IntakeScreen {onImagesReady} {onProjectImported} />
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
            <h2><span class="bracket" aria-hidden="true">[ </span>images<span class="bracket" aria-hidden="true"> ]</span></h2>
            <div class="images-head">
              <label>
                <input type="checkbox" checked={showHeldOnly} onchange={() => (showHeldOnly = !showHeldOnly)} />
                <span class="key" aria-hidden="true">[f]</span> show held-back only
              </label>
              <button type="button" class="btn danger clear-btn" onclick={() => (confirmClear = true)}>clear session</button>
            </div>
            <ImageList images={session.images} currentImageId={session.currentImageId} {showHeldOnly} onSelect={selectImage} />
            <p class="dim nav-hint">
              <span class="key" aria-hidden="true">[←/→]</span> previous/next ·
              type a number to score ·
              <span class="key" aria-hidden="true">[r]</span> edit score
            </p>
          </section>
        </div>

        <div class="col-main">
          <PreviewPane
            image={currentImage}
            {progressLabel}
            onRate={setRating}
            onRateCommit={commitRating}
            onToggleHold={toggleHold}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            bind:ratingInputEl={ratingInputEl}
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
  .images-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
</style>
