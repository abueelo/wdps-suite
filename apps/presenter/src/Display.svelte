<script lang="ts">
  // Audience-facing screen — always black, no suite chrome (no header,
  // footer, theme toggle: this isn't a themed page, it's a projector
  // output). Read-only: it only ever reacts to the live session, never
  // writes to it.
  import { sessionStore } from './lib/session/store.svelte.js';
  import { blobToDisplayUrl } from './lib/display/orientation.js';
  import type { PresenterImage } from './lib/types.js';

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
    {#if session.revealOnDisplay}
      <p class="caption">
        {currentImage.title || '(untitled)'}
        {#if currentImage.photographer}<span class="dim"> — {currentImage.photographer}</span>{/if}
      </p>
    {/if}
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
    left: 0;
    right: 0;
    bottom: 2vh;
    text-align: center;
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    color: #b8b5a9;
    font-size: 1.5vw;
  }
  .caption .dim {
    color: #6e6b60;
  }
</style>
