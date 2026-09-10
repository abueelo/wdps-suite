<script lang="ts">
  import { Divider, ThemeToggle, ConfirmModal } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { sessionStore } from './lib/session/store.svelte.js';
  import { clearSession as clearStoredSession } from './lib/session/db.js';
  import { checkOwnerAuth } from './lib/auth/ownerAuth.js';
  import { openDisplayWindow } from './lib/display/secondScreen.js';
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

  function updateSlide(which: 'titleSlide' | 'breakSlide', patch: Partial<SlideConfig>) {
    void sessionStore.update((s) => {
      Object.assign(s[which], patch);
    });
  }

  function toggleReveal() {
    void sessionStore.update((s) => {
      s.revealOnDisplay = !s.revealOnDisplay;
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

  async function openDisplay() {
    try {
      const result = await openDisplayWindow('/presenter/display.html');
      displayStatus =
        result.mode === 'auto'
          ? 'display window opened on the second screen.'
          : 'display window opened — drag it to the projector and press F11 to fullscreen it.';
    } catch (err) {
      displayStatus = err instanceof Error ? err.message : 'could not open the display window';
    }
  }

  async function clearSession() {
    await sessionStore.replace(emptySession());
    confirmClear = false;
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
      h: () => {
        window.location.href = '/';
      },
      ArrowRight: () => step(1),
      ArrowDown: () => step(1),
      ArrowLeft: () => step(-1),
      ArrowUp: () => step(-1),
      k: () => toggleHold(),
      f: () => (showHeldOnly = !showHeldOnly),
      i: () => setScene('title'),
      b: () => setScene('break'),
      l: () => setScene('photo'),
      v: () => toggleReveal(),
      w: () => toggleBorder(),
      d: () => {
        void openDisplay();
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
    <pre class="name" aria-hidden="true" style="--banner-cols: 25;"> █▀█ █▀█ █▀▀ ▄▀▀ █▀▀ █▄█ ▀█▀ █▀▀ █▀█
 █▀▀ █▀▄ ██▄ ▄██ ██▄ █▀█  █  ██▄ █▀▄</pre>
    <h1 class="visually-hidden">presenter</h1>
    <div class="head-row">
      <p class="tagline dim">run the competition<span class="cursor" aria-hidden="true">█</span></p>
      <nav class="bracket-nav" aria-label="theme and suite">
        <a href="/"><span class="key" aria-hidden="true">[h]</span> wdps</a>
        <ThemeToggle />
      </nav>
    </div>
  </header>

  {#if authState === 'loading' || (authState === 'in' && !sessionStore.ready)}
    <p class="dim">loading…</p>
  {:else if authState === 'out'}
    <AuthGate />
  {:else}
    <p class="warn dev-note">[ under development — expect rough edges, keep a backup plan for the night ]</p>

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
          onShowNow={() => setScene('title')}
        />
        <Divider />
        <SlideEditor
          label="break slide"
          slide={session.breakSlide}
          active={session.scene === 'break'}
          showKey="b"
          onUpdate={(p) => updateSlide('breakSlide', p)}
          onShowNow={() => setScene('break')}
        />
        {#if session.images.length > 0}
          <Divider />
          <button type="button" class="btn" class:primary={session.scene === 'photo'} onclick={() => setScene('photo')}>
            <span class="key" aria-hidden="true">[l]</span> {session.scene === 'photo' ? 'showing current image' : 'back to current image'}
          </button>
        {/if}
      </details>
    {/snippet}

    {#if session.images.length === 0}
      <IntakeScreen {onImagesReady} {onProjectImported} />
      {@render slidesDetails()}
      <DisplaySettingsPanel
        revealOnDisplay={session.revealOnDisplay}
        borderGuide={session.borderGuide}
        {displayStatus}
        onToggleReveal={toggleReveal}
        onToggleBorder={toggleBorder}
        onOpenDisplay={openDisplay}
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
            revealOnDisplay={session.revealOnDisplay}
            borderGuide={session.borderGuide}
            {displayStatus}
            onToggleReveal={toggleReveal}
            onToggleBorder={toggleBorder}
            onOpenDisplay={openDisplay}
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
