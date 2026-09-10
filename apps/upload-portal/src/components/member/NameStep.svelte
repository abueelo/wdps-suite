<script lang="ts">
  import { isFullName } from '../../lib/member/name.js';

  let {
    initialName,
    onConfirm,
    onBack
  }: {
    initialName: string;
    onConfirm: (name: string) => void;
    onBack: () => void;
  } = $props();

  let name = $state(initialName);
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>your name<span class="bracket" aria-hidden="true"> ]</span></h2>
  <button type="button" class="btn back-link" onclick={onBack}>&larr; pick a different competition</button>

  <label class="field">
    <span>your <span class="field-label">full name</span></span>
    <input type="text" bind:value={name} placeholder="John Doe" autocomplete="off" />
  </label>
  <p class="dim name-hint">first and last name please, so entries can be credited correctly</p>

  <button class="btn primary continue-btn" onclick={() => onConfirm(name.trim())} disabled={!isFullName(name)}>
    continue
  </button>
</section>

<style>
  .back-link {
    margin-top: 0.75rem;
    border-color: transparent;
    padding-left: 0;
  }
  .field {
    display: flex;
    align-items: center;
    gap: 1ch;
    margin-top: 1.25rem;
  }
  .field input {
    width: 18rem;
  }
  .field-label {
    font-weight: bold;
  }
  .name-hint {
    margin-top: 0.35rem;
    font-size: 0.85em;
  }
  .continue-btn {
    margin-top: 1.25rem;
  }
</style>
