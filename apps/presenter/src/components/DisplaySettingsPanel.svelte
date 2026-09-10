<script lang="ts">
  let {
    revealTitle,
    revealPhotographer,
    revealFlashOnly,
    borderGuide,
    onToggleRevealTitle,
    onToggleRevealPhotographer,
    onToggleRevealFlashOnly,
    onToggleBorder
  }: {
    revealTitle: boolean;
    revealPhotographer: boolean;
    revealFlashOnly: boolean;
    borderGuide: boolean;
    onToggleRevealTitle: () => void;
    onToggleRevealPhotographer: () => void;
    onToggleRevealFlashOnly: () => void;
    onToggleBorder: () => void;
  } = $props();
</script>

<details class="panel">
  <summary><span class="bracket" aria-hidden="true">[ </span>display<span class="bracket" aria-hidden="true"> ]</span></summary>

  <div class="toggles">
    <label>
      <input type="checkbox" checked={revealTitle} onchange={onToggleRevealTitle} />
      <span class="key" aria-hidden="true">[v]</span> reveal title on display
    </label>
    <label>
      <input type="checkbox" checked={revealPhotographer} onchange={onToggleRevealPhotographer} />
      <span class="key" aria-hidden="true">[c]</span> reveal photographer on display
    </label>
    <label>
      <input type="checkbox" checked={revealFlashOnly} onchange={onToggleRevealFlashOnly} />
      <span class="key" aria-hidden="true">[x]</span> only show briefly when switching image
    </label>
    <label>
      <input type="checkbox" checked={borderGuide} onchange={onToggleBorder} />
      <span class="key" aria-hidden="true">[w]</span> thin white border guide
    </label>
  </div>
</details>

<style>
  .toggles {
    margin-top: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
</style>
