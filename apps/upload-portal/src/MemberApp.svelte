<script lang="ts">
  import { ThemeToggle } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { getSettings, listCompetitions, memberLogin } from './lib/api/client.js';
  import type { Competition } from './lib/types.js';
  import PasscodeGate from './components/PasscodeGate.svelte';
  import CompetitionPicker from './components/member/CompetitionPicker.svelte';
  import UploadForm from './components/member/UploadForm.svelte';

  const GATE_PASSED_KEY = 'wdps-upload-portal-member-passed';

  let loading = $state(true);
  let gateEnabled = $state(false);
  let gatePassed = $state(localStorage.getItem(GATE_PASSED_KEY) === '1');
  let competitions = $state<Competition[]>([]);
  let selected = $state<Competition | null>(null);
  let error = $state('');

  $effect(() => {
    (async () => {
      try {
        const settings = await getSettings();
        gateEnabled = settings.memberGateEnabled;
        if (!gateEnabled || gatePassed) {
          competitions = await listCompetitions();
        }
      } catch (err) {
        error = err instanceof Error ? err.message : 'failed to load';
      } finally {
        loading = false;
      }
    })();
  });

  async function submitPasscode(passcode: string) {
    await memberLogin(passcode);
    gatePassed = true;
    localStorage.setItem(GATE_PASSED_KEY, '1');
    competitions = await listCompetitions();
  }

  $effect(() => {
    return bindShortcuts({
      t: () => document.getElementById('theme-toggle')?.click(),
      a: () => { window.location.href = '/upload-portal/admin.html'; },
      h: () => { window.location.href = '/'; }
    });
  });
</script>

<div class="page">
  <header class="suite-header">
    <h1 class="name">upload-portal</h1>
    <div class="head-row">
      <p class="tagline dim">submit your competition entries<span class="cursor" aria-hidden="true">█</span></p>
      <nav class="bracket-nav" aria-label="theme and admin">
        <a href="/"><span class="key" aria-hidden="true">[h]</span> wdps</a>
        <a href="/upload-portal/admin.html"><span class="key" aria-hidden="true">[a]</span> admin</a>
        <ThemeToggle />
      </nav>
    </div>
  </header>

  {#if loading}
    <p class="dim">loading…</p>
  {:else if error}
    <p class="danger">{error}</p>
  {:else if gateEnabled && !gatePassed}
    <PasscodeGate title="members only" description="enter the club passcode to submit entries." onSubmit={submitPasscode} />
  {:else if !selected}
    <CompetitionPicker {competitions} onPick={(c) => (selected = c)} />
  {:else}
    <UploadForm competition={selected} onBack={() => (selected = null)} />
  {/if}

  <footer class="suite-footer">
    <p><span aria-hidden="true">☼ </span><a class="edit-link" href="/upload-portal/owner.html"><span class="swap">abueelo</span></a> · <span id="year">1970</span><span aria-hidden="true"> ☼</span></p>
  </footer>
</div>

<style>
  .name {
    font-size: 1.75rem;
    letter-spacing: 0.05em;
    margin: 0;
  }
  .tagline {
    margin-top: 0.75rem;
  }
</style>
