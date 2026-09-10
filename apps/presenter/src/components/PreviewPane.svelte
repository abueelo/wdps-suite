<script lang="ts">
  import type { PresenterImage } from '../lib/types.js';
  import { blobToDisplayUrl } from '../lib/display/orientation.js';
  import RatingControl from './RatingControl.svelte';

  let {
    image,
    progressLabel,
    onRate,
    onRateCommit,
    onToggleHold,
    onPrev,
    onNext,
    ratingInputEl = $bindable<HTMLInputElement | undefined>(undefined)
  }: {
    image: PresenterImage | null;
    progressLabel?: string;
    onRate: (rating: number | null) => void;
    onRateCommit?: () => void;
    onToggleHold: () => void;
    onPrev: () => void;
    onNext: () => void;
    ratingInputEl?: HTMLInputElement;
  } = $props();

  let previewUrl = $state('');

  $effect(() => {
    const current = image;
    let url = '';
    let cancelled = false;
    if (current) {
      blobToDisplayUrl(current.blob, current.filename).then((u) => {
        if (cancelled) return;
        url = u;
        previewUrl = u;
      });
    } else {
      previewUrl = '';
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  });
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>preview<span class="bracket" aria-hidden="true"> ]</span></h2>
  {#if progressLabel}<p class="dim progress">{progressLabel}</p>{/if}

  {#if !image}
    <p class="dim">no image selected</p>
  {:else}
    <div class="preview-frame">
      {#if previewUrl}
        <img src={previewUrl} alt="" />
      {/if}
    </div>
    <p class="meta">
      <span>{image.title || '(untitled)'}</span>
      {#if image.photographer}<span class="dim"> — {image.photographer}</span>{/if}
      <span class="dim filename"> ({image.filename})</span>
    </p>
    <div class="nav-row">
      <button type="button" class="btn" onclick={onPrev}><span class="key" aria-hidden="true">[←]</span> prev</button>
      <button type="button" class="btn" onclick={onNext}>next <span class="key" aria-hidden="true">[→]</span></button>
    </div>
    <div class="controls">
      <RatingControl rating={image.rating} onChange={onRate} onCommit={onRateCommit} bind:inputEl={ratingInputEl} />
      <button type="button" class="btn" class:primary={image.held} onclick={onToggleHold}>
        <span class="key" aria-hidden="true">[k]</span> {image.held ? 'held back' : 'hold back'}
      </button>
    </div>
  {/if}
</section>

<style>
  .preview-frame {
    background: #000;
    border: 1px solid var(--border);
    height: min(48vh, 30rem);
    margin-top: 1rem;
  }
  .preview-frame img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .progress {
    margin-top: 0.5rem;
  }
  .meta {
    margin-top: 0.75rem;
  }
  .filename {
    font-size: 0.9em;
  }
  .nav-row {
    margin-top: 0.75rem;
    display: flex;
    gap: 1rem;
  }
  .controls {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
</style>
