<script lang="ts">
  import { ThemeToggle } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { getSettings, listCompetitions, memberLogin } from './lib/api/client.js';
  import { loadSavedName, saveName } from './lib/member/name.js';
  import type { Competition } from './lib/types.js';
  import PasscodeGate from './components/PasscodeGate.svelte';
  import CompetitionPicker from './components/member/CompetitionPicker.svelte';
  import NameStep from './components/member/NameStep.svelte';
  import UploadForm from './components/member/UploadForm.svelte';

  const GATE_PASSED_KEY = 'wdps-upload-portal-member-passed';

  let loading = $state(true);
  let gateEnabled = $state(false);
  let gatePassed = $state(localStorage.getItem(GATE_PASSED_KEY) === '1');
  let competitions = $state<Competition[]>([]);
  let selected = $state<Competition | null>(null);
  let error = $state('');

  // Confirmed once per app load, pre-filled from whatever name was last
  // used on this browser — so a returning member doesn't retype it, but
  // it's still its own step rather than folded into the upload screen.
  let photographerName = $state(loadSavedName());
  let nameConfirmed = $state(false);

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

  // This is a shared-device tool at a competition night — one laptop,
  // one photographer at a time. Leaving the page (closing the tab,
  // navigating off, or just going back) has to drop back to "pick a
  // competition" rather than leave the next person looking at whoever
  // used it last. This resets in-memory state only — the saved name
  // convenience and the actual uploaded photos on the server are
  // untouched, only what's currently on screen.
  $effect(() => {
    function reset() {
      selected = null;
      nameConfirmed = false;
    }
    window.addEventListener('pagehide', reset);
    return () => window.removeEventListener('pagehide', reset);
  });
</script>

<div class="page">
  <header class="suite-header">
    <pre class="name" aria-hidden="true" style="--banner-cols: 34;">█ █ █▀█ █   █▀█ ▄▀▄ █▀▄  █▀█ █▀█ █▀█ ▀█▀ ▄▀▄ █
█▄█ █▀▀ █▄▄ █▄█ █▀█ █▄▀  █▀▀ █▄█ █▀▄  █  █▀█ █▄▄</pre>
    <h1 class="visually-hidden">upload-portal</h1>
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
  {:else if !nameConfirmed}
    <NameStep
      initialName={photographerName}
      onBack={() => (selected = null)}
      onConfirm={(name) => { photographerName = name; saveName(name); nameConfirmed = true; }}
    />
  {:else}
    <UploadForm competition={selected} photographer={photographerName} onBack={() => (selected = null)} onChangeName={() => (nameConfirmed = false)} />
  {/if}

  <footer class="suite-footer">
    <p><span aria-hidden="true">☼ </span><a class="edit-link" href="/upload-portal/owner.html"><span class="swap">abueelo</span></a> · <span id="year">1970</span><span aria-hidden="true"> ☼</span></p>
  </footer>
</div>

<style>
  .tagline {
    margin-top: 0.75rem;
  }
</style>
