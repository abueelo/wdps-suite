<script lang="ts">
  // The actual "what's on screen" renderer — title/break/photo, border
  // guide, revealed caption with its flash timing. Used by both
  // Display.svelte (the real projector window, full page) and
  // PreviewPane (a small embedded copy on the control panel), so the
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
  import type { PresenterImage } from '../lib/types.js';

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
  {:else if currentImage}
    <img class="frame" class:bordered={session.borderGuide} src={photoUrl} alt="" />
    {#if captionShown}
      <p class="caption">
        {#if session.revealTitle}<span>{currentImage.title || '(untitled)'}</span>{/if}
        {#if session.revealTitle && session.revealPhotographer}<span> — </span>{/if}
        {#if session.revealPhotographer && currentImage.photographer}<span>{currentImage.photographer}</span>{/if}
      </p>
    {/if}
  {:else}
    <p class="heading dim">no image selected</p>
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
  .caption {
    position: absolute;
    left: 50%;
    bottom: 4cqh;
    transform: translateX(-50%);
    background: #000;
    color: #fff;
    padding: 0.5em 1em;
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 1.5cqw;
    white-space: nowrap;
  }
</style>
