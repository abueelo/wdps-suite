<script lang="ts">
  import { ownerResetPasscode } from '../../lib/api/client.js';

  let { role, label }: { role: 'admin' | 'member'; label: string } = $props();

  let passcode = $state('');
  let saving = $state(false);
  let message = $state('');
  let error = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (passcode.length < 4) return;
    saving = true;
    error = '';
    message = '';
    try {
      await ownerResetPasscode(role, passcode);
      message = `${label} passcode updated.`;
      passcode = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'failed to reset';
    } finally {
      saving = false;
    }
  }
</script>

<form class="reset-form" onsubmit={submit}>
  <label class="dim" for="reset-{role}">{label} passcode</label>
  <div class="row">
    <input id="reset-{role}" type="password" bind:value={passcode} placeholder="new passcode" autocomplete="off" minlength="4" />
    <button type="submit" class="btn" disabled={saving || passcode.length < 4}>{saving ? 'saving…' : 'reset'}</button>
  </div>
  {#if message}<p class="ok">{message}</p>{/if}
  {#if error}<p class="danger">{error}</p>{/if}
</form>

<style>
  .reset-form {
    margin-top: 1rem;
  }
  .row {
    display: flex;
    gap: 1ch;
    margin-top: 0.3rem;
  }
  .row input {
    flex: 1;
    min-width: 10rem;
  }
</style>
