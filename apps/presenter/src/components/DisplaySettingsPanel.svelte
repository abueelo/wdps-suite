<script lang="ts">
  let {
    revealOnDisplay,
    borderGuide,
    displayStatus,
    onToggleReveal,
    onToggleBorder,
    onOpenDisplay
  }: {
    revealOnDisplay: boolean;
    borderGuide: boolean;
    displayStatus: string;
    onToggleReveal: () => void;
    onToggleBorder: () => void;
    onOpenDisplay: () => void;
  } = $props();
</script>

<details class="panel">
  <summary><span class="bracket" aria-hidden="true">[ </span>display<span class="bracket" aria-hidden="true"> ]</span></summary>

  <button type="button" class="btn primary" onclick={onOpenDisplay}>
    <span class="key" aria-hidden="true">[d]</span> open display window
  </button>
  {#if displayStatus}<p class="dim status">{displayStatus}</p>{/if}

  <div class="toggles">
    <label>
      <input type="checkbox" checked={revealOnDisplay} onchange={onToggleReveal} />
      <span class="key" aria-hidden="true">[v]</span> reveal photographer/title on display
    </label>
    <label>
      <input type="checkbox" checked={borderGuide} onchange={onToggleBorder} />
      <span class="key" aria-hidden="true">[w]</span> thin white border guide
    </label>
  </div>
</details>

<style>
  .status {
    margin-top: 0.5rem;
  }
  .toggles {
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
</style>
