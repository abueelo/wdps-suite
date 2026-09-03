<script lang="ts">
  // A terminal-styled stand-in for window.confirm(), for anything
  // destructive (delete image, delete competition, ...). The parent owns
  // whether it's shown at all — this just renders the dialog and reports
  // back which button was pressed.
  let {
    message,
    confirmLabel = 'yes',
    cancelLabel = 'cancel',
    onConfirm,
    onCancel
  }: {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let yesButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    const lastFocused = document.activeElement as HTMLElement | null;
    yesButton?.focus();
    return () => lastFocused?.focus?.();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onCancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- The overlay itself isn't a control — Escape (above) and the two
     buttons below are the real interactive surface. It only needs a
     click handler to dismiss on backdrop click. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleBackdropClick}>
  <div class="modal-window" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-message">
    <div class="modal-title"><span class="bracket" aria-hidden="true">[ </span>confirm<span class="bracket" aria-hidden="true"> ]</span></div>
    <p id="confirm-modal-message">{message}</p>
    <p class="confirm-actions">
      <button type="button" class="btn" bind:this={yesButton} onclick={onConfirm}>[ {confirmLabel} ]</button>
      <button type="button" class="btn" onclick={onCancel}>[ {cancelLabel} ]</button>
    </p>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 100;
  }

  .modal-window {
    position: relative;
    border: 1px solid var(--border);
    background: var(--bg);
    padding: 1.5rem 1.75rem 1.25rem;
    max-width: 32rem;
    width: 100%;
  }

  .modal-title {
    position: absolute;
    top: -0.85em;
    left: 1.25ch;
    background: var(--bg);
    padding: 0 1ch;
    letter-spacing: 0.05em;
  }

  .modal-title .bracket {
    color: var(--dim);
  }

  .confirm-actions {
    display: flex;
    gap: 1ch;
    margin: 1rem 0 0;
  }
</style>
