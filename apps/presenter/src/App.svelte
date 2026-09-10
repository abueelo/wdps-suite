<script lang="ts">
  import { Divider, ThemeToggle, ConfirmModal } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { sessionStore } from './lib/session/store.svelte.js';
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

  function toggleHold() {
    const id = session.currentImageId;
    if (!id) return;
    void sessionStore.update((s) => {
      const img = s.images.find((i) => i.id === id);
      if (img) img.held = !img.held;
    });
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

  $effect(() => {
    return bindShortcuts({
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
      '1': () => setScene('title'),
      '2': () => setScene('break'),
      '3': () => setScene('photo'),
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

    <div class="workspace">
      <div class="column setup-column">
        <section class="panel">
          <h2><span class="bracket" aria-hidden="true">[ </span>slides<span class="bracket" aria-hidden="true"> ]</span></h2>
          <SlideEditor
            label="title slide"
            slide={session.titleSlide}
            showHeading={true}
            active={session.scene === 'title'}
            showKey="1"
            onUpdate={(p) => updateSlide('titleSlide', p)}
            onShowNow={() => setScene('title')}
          />
          <Divider />
          <SlideEditor
            label="break slide"
            slide={session.breakSlide}
            active={session.scene === 'break'}
            showKey="2"
            onUpdate={(p) => updateSlide('breakSlide', p)}
            onShowNow={() => setScene('break')}
          />
          {#if session.images.length > 0}
            <Divider />
            <button type="button" class="btn" class:primary={session.scene === 'photo'} onclick={() => setScene('photo')}>
              <span class="key" aria-hidden="true">[3]</span> {session.scene === 'photo' ? 'showing current image' : 'back to current image'}
            </button>
          {/if}
        </section>

        <DisplaySettingsPanel
          revealOnDisplay={session.revealOnDisplay}
          borderGuide={session.borderGuide}
          {displayStatus}
          onToggleReveal={toggleReveal}
          onToggleBorder={toggleBorder}
          onOpenDisplay={openDisplay}
        />

        {#if session.images.length > 0}
          <ExportPanel {session} bind:this={exportPanelRef} />

          <section class="panel">
            <h2><span class="bracket" aria-hidden="true">[ </span>session<span class="bracket" aria-hidden="true"> ]</span></h2>
            <button type="button" class="btn danger" onclick={() => (confirmClear = true)}>start over</button>
          </section>
        {/if}
      </div>

      <div class="column main-column">
        {#if session.images.length === 0}
          <IntakeScreen {onImagesReady} {onProjectImported} />
        {:else}
          <section class="panel">
            <h2><span class="bracket" aria-hidden="true">[ </span>images<span class="bracket" aria-hidden="true"> ]</span></h2>
            <label>
              <input type="checkbox" checked={showHeldOnly} onchange={() => (showHeldOnly = !showHeldOnly)} />
              <span class="key" aria-hidden="true">[f]</span> show held-back only
            </label>
            <ImageList images={session.images} currentImageId={session.currentImageId} {showHeldOnly} onSelect={selectImage} />
            <p class="dim nav-hint">
              <span class="key" aria-hidden="true">[←/→]</span> previous/next ·
              <span class="key" aria-hidden="true">[r]</span> jump to score field
            </p>
          </section>

          <PreviewPane image={currentImage} onRate={setRating} onToggleHold={toggleHold} bind:ratingInputEl={ratingInputEl} />
        {/if}
      </div>
    </div>

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
  .column {
    flex: 1 1 22rem;
    min-width: 0;
  }
  .nav-hint {
    margin-top: 0.75rem;
  }
</style>
