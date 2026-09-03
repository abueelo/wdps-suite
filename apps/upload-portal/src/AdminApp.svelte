<script lang="ts">
  import { ThemeToggle } from '@wdps/shared-ui';
  import { adminMe, adminLogin, adminLogout, listAllCompetitions } from './lib/api/client.js';
  import type { Competition } from './lib/types.js';
  import PasscodeGate from './components/PasscodeGate.svelte';
  import CompetitionList from './components/admin/CompetitionList.svelte';
  import CompetitionDetail from './components/admin/CompetitionDetail.svelte';
  import SettingsPanel from './components/admin/SettingsPanel.svelte';

  let checking = $state(true);
  let authed = $state(false);
  let competitions = $state<Competition[]>([]);
  let openId = $state<string | null>(null);
  let showSettings = $state(false);

  $effect(() => {
    adminMe()
      .then((r) => (authed = r.authed))
      .finally(() => (checking = false));
  });

  $effect(() => {
    if (authed && !openId) refresh();
  });

  async function refresh() {
    competitions = await listAllCompetitions();
  }

  async function login(passcode: string) {
    await adminLogin(passcode);
    authed = true;
  }

  async function logout() {
    await adminLogout();
    authed = false;
    openId = null;
  }
</script>

<div class="page">
  <header class="suite-header">
    <h1 class="name">upload-portal admin</h1>
    <div class="head-row">
      <p class="tagline dim">review entries, manage competitions<span class="cursor" aria-hidden="true">█</span></p>
      <nav class="bracket-nav" aria-label="theme and account">
        {#if authed}
          <button type="button" onclick={() => (showSettings = !showSettings)}>
            <span class="key" aria-hidden="true">[s]</span> settings
          </button>
          <button type="button" onclick={logout}>
            <span class="key" aria-hidden="true">[x]</span> log out
          </button>
        {/if}
        <ThemeToggle />
      </nav>
    </div>
  </header>

  {#if checking}
    <p class="dim">checking…</p>
  {:else if !authed}
    <PasscodeGate title="admin login" description="enter the admin passcode." onSubmit={login} />
  {:else}
    {#if showSettings}
      <SettingsPanel />
    {/if}
    {#if openId}
      <CompetitionDetail competitionId={openId} onBack={() => { openId = null; refresh(); }} />
    {:else}
      <CompetitionList {competitions} onChanged={refresh} onOpen={(c) => (openId = c.id)} />
    {/if}
  {/if}

  <footer class="suite-footer">
    <p><span aria-hidden="true">☼ </span><a class="edit-link" href="/upload-portal/owner.html"><span class="swap">abueelo</span></a> · <span id="year">1970</span><span aria-hidden="true"> ☼</span></p>
  </footer>
</div>

<style>
  .name {
    font-size: 1.5rem;
    letter-spacing: 0.05em;
    margin: 0;
  }
  .tagline {
    margin-top: 0.75rem;
  }
  nav.bracket-nav button {
    font: inherit;
    color: var(--fg);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
</style>
