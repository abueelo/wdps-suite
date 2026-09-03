<script lang="ts">
  let {
    title,
    description,
    onSubmit
  }: {
    title: string;
    description: string;
    onSubmit: (passcode: string) => Promise<void>;
  } = $props();

  let passcode = $state('');
  let busy = $state(false);
  let error = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      await onSubmit(passcode);
    } catch (err) {
      error = err instanceof Error ? err.message : 'something went wrong';
    } finally {
      busy = false;
    }
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>{title}<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="dim">{description}</p>
  <form class="gate-form" onsubmit={submit}>
    <input type="password" bind:value={passcode} placeholder="passcode" autocomplete="off" required />
    <button class="btn primary" type="submit" disabled={busy}>{busy ? 'checking…' : 'enter'}</button>
  </form>
  {#if error}<p class="danger">{error}</p>{/if}
</section>

<style>
  .gate-form {
    display: flex;
    gap: 1ch;
    margin-top: 1rem;
    flex-wrap: wrap;
  }
  .gate-form input {
    flex: 1;
    min-width: 12rem;
  }
</style>
