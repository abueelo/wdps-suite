<script lang="ts">
  // Audience-facing screen — always black, no suite chrome (no header,
  // footer, theme toggle: this isn't a themed page, it's a projector
  // output). Read-only: it only ever reacts to the live session, never
  // writes to it.
  import { sessionStore } from './lib/session/store.svelte.js';
  import { blobToDisplayUrl } from './lib/display/orientation.js';
  import type { PresenterImage } from './lib/types.js';

  const FLASH_DURATION_MS = 4000;

  let session = $derived(sessionStore.current);
  let currentImage = $derived<PresenterImage | null>(session.images.find((i) => i.id === session.currentImageId) ?? null);

  // Falls back to the photo scene if the scene the session points at has
  // since been disabled (e.g. the presenter unticked "break slide" while
  // it was showing) — never gets stuck on a blank slide.
  let activeScene = $derived(
    (session.scene === 'title' && !session.titleSlide.enabled) || (session.scene === 'break' && !session.breakSlide.enabled)
      ? 'photo'
      : session.scene
  );

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

  let photoUrl = $state('');
  $effect(() => {
    const image = currentImage;
    let url = '';
    let cancelled = false;
    if (image) {
      blobToDisplayUrl(image.blob, image.filename).then((u) => {
        if (cancelled) return;
        url = u;
        photoUrl = u;
      });
    } else {
      photoUrl = '';
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });

  // In "flash" mode the caption only shows for a few seconds right after
  // switching to a new image, rather than staying up the whole time —
  // re-armed every time currentImage.id changes.
  let flashVisible = $state(false);
  $effect(() => {
    const id = currentImage?.id;
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

  // Best-effort auto-fullscreen already happens where this window gets
  // opened (secondScreen.ts) — but the Fullscreen API can still refuse
  // that depending on browser/timing. This is the fallback: a small
  // hint that appears if fullscreen didn't take, and a click anywhere
  // requests it as a genuine gesture on this document, which always
  // works.
  let showFullscreenHint = $state(false);

  $effect(() => {
    const timer = setTimeout(() => {
      if (!document.fullscreenElement) showFullscreenHint = true;
    }, 1000);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    function handleChange() {
      if (document.fullscreenElement) showFullscreenHint = false;
    }
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  });

  function handleStageClick() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="stage" onclick={handleStageClick}>
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
  {:else if currentImage}
    <img class="frame" class:bordered={session.borderGuide} src={photoUrl} alt="" />
    {#if captionShown}
      <p class="caption">
        {#if session.revealTitle}<span>{currentImage.title || '(untitled)'}</span>{/if}
        {#if session.revealTitle && session.revealPhotographer}<span> — </span>{/if}
        {#if session.revealPhotographer && currentImage.photographer}<span>{currentImage.photographer}</span>{/if}
      </p>
    {/if}
  {/if}

  {#if showFullscreenHint}
    <p class="fullscreen-hint">click to fill the screen</p>
  {/if}
</div>

<style>
  :global(html),
  :global(body) {
    background: #000;
    height: 100%;
  }
  :global(#app) {
    height: 100%;
  }
  .stage {
    position: fixed;
    inset: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .frame {
    max-width: 100vw;
    max-height: 100vh;
    object-fit: contain;
  }
  .frame.bordered {
    outline: 3px solid #fff;
    outline-offset: -3px;
  }
  .heading {
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    color: #c9a25e;
    font-size: 4vw;
    letter-spacing: 0.1em;
  }
  .heading.dim {
    color: #6e6b60;
  }
  .caption {
    position: fixed;
    left: 50%;
    bottom: 4vh;
    transform: translateX(-50%);
    background: #000;
    color: #fff;
    padding: 0.5em 1em;
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 1.5vw;
    white-space: nowrap;
  }
  .fullscreen-hint {
    position: fixed;
    top: 1vh;
    right: 1vw;
    background: #000;
    color: #6e6b60;
    padding: 0.3em 0.7em;
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.85rem;
    cursor: pointer;
  }
</style>
