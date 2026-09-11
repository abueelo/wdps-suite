<script lang="ts">
  // Small preview image for a list row. Reuses the same
  // orientation/TIFF-aware decode as the main preview, just displayed
  // tiny — object-fit: contain, same as the main preview, so a list
  // thumbnail never crops either.
  import { blobToDisplayUrl } from '../lib/display/orientation.js';

  let { blob, filename }: { blob: Blob; filename: string } = $props();

  let url = $state('');

  $effect(() => {
    let objectUrl = '';
    let cancelled = false;
    blobToDisplayUrl(blob, filename).then((u) => {
      if (cancelled) return;
      objectUrl = u;
      url = u;
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });
</script>

<span class="thumb" aria-hidden="true">
  {#if url}<img src={url} alt="" />{/if}
</span>

<style>
  /* No fixed box, no background or border — just the image itself, at
     its own aspect ratio, capped small so a wildly oversized original
     doesn't blow out the row. */
  .thumb {
    display: inline-flex;
    flex-shrink: 0;
  }
  .thumb img {
    display: block;
    max-width: 3.6rem;
    max-height: 2.4rem;
    width: auto;
    height: auto;
  }
</style>
