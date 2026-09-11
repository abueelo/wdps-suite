<script lang="ts">
  import type { SlideConfig } from '../lib/types.js';

  let {
    label,
    slide,
    showHeading = false,
    active,
    showKey,
    onUpdate,
    onShowNow
  }: {
    label: string;
    slide: SlideConfig;
    showHeading?: boolean;
    active: boolean;
    showKey: string;
    onUpdate: (patch: Partial<SlideConfig>) => void;
    onShowNow: () => void;
  } = $props();

  let previewUrl = $state('');

  $effect(() => {
    const image = slide.image;
    let url = '';
    if (image) {
      url = URL.createObjectURL(image);
      previewUrl = url;
    } else {
      previewUrl = '';
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  function handleFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onUpdate({ image: file });
    input.value = '';
  }
</script>

<div class="slide-editor">
  <div class="row">
    <label>
      <input type="checkbox" checked={slide.enabled} onchange={(e) => onUpdate({ enabled: (e.currentTarget as HTMLInputElement).checked })} />
      {label}
    </label>
    <button type="button" class="btn" class:primary={active} onclick={onShowNow} disabled={!slide.enabled}>
      <span class="key" aria-hidden="true">[{showKey}]</span> {active ? 'showing now' : 'show now'}
    </button>
  </div>

  {#if showHeading}
    <div class="row">
      <label for="{label}-heading">heading</label>
      <input
        id="{label}-heading"
        type="text"
        value={slide.heading ?? ''}
        oninput={(e) => onUpdate({ heading: (e.currentTarget as HTMLInputElement).value })}
      />
    </div>
  {/if}

  <div class="row image-row">
    {#if previewUrl}
      <img src={previewUrl} alt="" class="thumb" />
      <button type="button" class="btn" onclick={() => onUpdate({ image: undefined })}>remove image</button>
    {/if}
    <label class="btn">
      {slide.image ? 'replace image' : 'upload image'}
      <input type="file" accept="image/*" onchange={handleFile} hidden />
    </label>
  </div>
</div>

<style>
  .slide-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .image-row {
    gap: 0.75rem;
  }
  .thumb {
    max-width: 8rem;
    max-height: 5rem;
    object-fit: contain;
    border: 1px solid var(--border);
    background: #000;
  }
  input[type='text'] {
    width: 20ch;
  }
</style>
