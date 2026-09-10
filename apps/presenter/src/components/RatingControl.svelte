<script lang="ts">
  let {
    rating,
    onChange,
    inputEl = $bindable<HTMLInputElement | undefined>(undefined)
  }: {
    rating: number | null;
    onChange: (value: number | null) => void;
    inputEl?: HTMLInputElement;
  } = $props();

  let el: HTMLInputElement | undefined = $state();

  $effect(() => {
    inputEl = el;
  });

  // Pushes `rating` into the DOM only when it changed for a reason other
  // than this input's own typing (switching to a different image, the
  // clear button, a clamped value correcting what was typed) — comparing
  // against the input's *current* DOM value rather than a mirrored
  // $state avoids fighting the user mid-keystroke, which a plain
  // value={rating} binding does: Svelte can decide the DOM already
  // reflects the last value it pushed and skip re-applying it, silently
  // leaving stale digits on screen while the real rating has moved on.
  $effect(() => {
    const target = el;
    if (!target) return;
    const domValue = target.value === '' ? null : Number(target.value);
    if (domValue !== rating) {
      target.value = rating === null ? '' : String(rating);
    }
  });

  function handleInput(e: Event) {
    const raw = (e.currentTarget as HTMLInputElement).value;
    if (raw === '') {
      onChange(null);
      return;
    }
    const n = Math.round(Number(raw));
    if (Number.isNaN(n)) return;
    onChange(Math.max(1, Math.min(20, n)));
  }
</script>

<div class="rating-control">
  <label for="rating-input">score</label>
  <input id="rating-input" bind:this={el} type="number" min="1" max="20" placeholder="—" oninput={handleInput} />
  <span class="dim">/ 20</span>
  {#if rating !== null}
    <button type="button" class="btn" onclick={() => onChange(null)}>clear</button>
  {/if}
</div>

<style>
  .rating-control {
    display: flex;
    align-items: center;
    gap: 0.75ch;
  }
  .rating-control input {
    width: 6ch;
    text-align: center;
  }
</style>
