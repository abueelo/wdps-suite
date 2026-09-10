<script lang="ts">
  // Audience-facing screen — always black, no suite chrome (no header,
  // footer, theme toggle: this isn't a themed page, it's a projector
  // output). The actual content (title/break/match/bracket, caption,
  // border guide) lives in Stage.svelte, shared with the control panel's
  // own preview so the two are guaranteed to look the same, not just similar.
  import Stage from './components/Stage.svelte';

  // Attempted immediately on load, in this document — not from the
  // window that opened this one (see secondScreen.ts for why that
  // doesn't stick). This is expected to fail more often than not: a
  // freshly opened window has no user-gesture history of its own, and
  // Chrome's fullscreen grant is gated on exactly that, regardless of
  // the gesture that opened the window in the first place. There's no
  // way around this from code — the one click below is genuinely the
  // only route to fullscreen a page can't already have.
  let showFullscreenHint = $state(false);

  $effect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {
      showFullscreenHint = true;
    });
  });

  $effect(() => {
    function handleChange() {
      if (document.fullscreenElement) showFullscreenHint = false;
    }
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  });

  function handlePageClick() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="page" onclick={handlePageClick}>
  <Stage />

  {#if showFullscreenHint}
    <button type="button" class="fullscreen-hint" onclick={handlePageClick}>
      click anywhere to go fullscreen
    </button>
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
  .page {
    position: fixed;
    inset: 0;
    background: #000;
  }
  .fullscreen-hint {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.88);
    border: 2px solid #c9a25e;
    color: #c9a25e;
    padding: 0.9em 1.6em;
    font: inherit;
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 1.5rem;
    letter-spacing: 0.04em;
    border-radius: 0;
    cursor: pointer;
  }
</style>
