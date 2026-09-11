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
  /* No box, no background or border — just the image, aspect ratio
     intact, capped to a max size (bigger than the list thumbnails,
     since these are the headline visual on the bracket). */
  .thumb {
    display: inline-flex;
    flex-shrink: 0;
  }
  .thumb img {
    display: block;
    max-width: 4.5cqw;
    max-height: 4.5cqw;
    width: auto;
    height: auto;
  }
</style>
