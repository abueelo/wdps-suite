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
  .thumb {
    display: inline-block;
    width: 3.2rem;
    height: 2.2rem;
    background: #000;
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
