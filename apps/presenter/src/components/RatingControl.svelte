<script lang="ts">
  let {
    rating,
    onChange,
    onCommit,
    inputEl = $bindable<HTMLInputElement | undefined>(undefined)
  }: {
    rating: number | null;
    onChange: (value: number | null) => void;
    /** Fires once a typed score is committed (Enter, or the field losing focus) — not on every keystroke. */
    onCommit?: () => void;
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

  // Whether the field has actually been edited since it last gained
  // focus — gates the blur-commit below so just tabbing through without
  // changing anything doesn't advance. Tracked by hand rather than
  // trusting the native 'change' event: that only fires for a value
  // change the browser considers a genuine user edit, which a
  // programmatic value set + dispatched input event (how typing a digit
  // with no field focused yet gets started, see App.svelte's
  // startTypingScore) doesn't reliably count as in every browser.
  let touchedSinceFocus = false;

  function handleFocus() {
    touchedSinceFocus = false;
  }

  function handleInput(e: Event) {
    touchedSinceFocus = true;
    const raw = (e.currentTarget as HTMLInputElement).value;
    if (raw === '') {
      onChange(null);
      return;
    }
    const n = Math.round(Number(raw));
    if (Number.isNaN(n)) return;
    onChange(Math.max(1, Math.min(20, n)));
  }

  function handleBlur() {
    if (touchedSinceFocus) onCommit?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Enter commits the same way tabbing away does — blur() below fires
    // the actual commit, this just triggers it without leaving the field
    // via Tab/click.
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
  }
</script>

<div class="rating-control">
  <label for="rating-input">score</label>
  <input
    id="rating-input"
    bind:this={el}
    type="number"
    min="1"
    max="20"
    placeholder="—"
    oninput={handleInput}
    onkeydown={handleKeydown}
    onfocus={handleFocus}
    onblur={handleBlur}
  />
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
