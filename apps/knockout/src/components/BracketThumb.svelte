<script lang="ts">
  // Same idea as Thumbnail.svelte (tiny TIFF-aware preview, object-fit:
  // contain so it never crops/stretches), but with hardcoded colors
  // instead of shared-ui's theme tokens — this renders inside
  // BracketTree, which (like the rest of Stage.svelte) has to look right
  // on the bare projector display.html too, and that document never
  // loads the theme stylesheet.
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
    width: 2.4cqw;
    height: 2.4cqw;
    background: #000;
    border: 1px solid #555;
    flex-shrink: 0;
  }
  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
