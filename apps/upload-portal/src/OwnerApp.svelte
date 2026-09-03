<script lang="ts">
  import { ThemeToggle } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { ownerMe, ownerLogout } from './lib/api/client.js';
  import PasscodeResetForm from './components/owner/PasscodeResetForm.svelte';
  import WipePanel from './components/owner/WipePanel.svelte';
  import LogView from './components/owner/LogView.svelte';

  const ERRORS: Record<string, string> = {
    '#error-state': "login failed: the browser lost track of the attempt. allow cookies and try again.",
    '#error-token': 'login failed: github rejected the app credentials — check GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET.',
    '#error-user': 'login failed: could not read your github profile — try again.',
    '#denied': "that github account isn't the site owner."
  };

  let checking = $state(true);
  let authed = $state(false);
  let hashMessage = $state(ERRORS[location.hash] || '');

  $effect(() => {
    ownerMe()
      .then((r) => (authed = r.authed))
      .finally(() => (checking = false));
  });

  async function logout() {
    await ownerLogout();
    authed = false;
  }

  $effect(() => {
    return bindShortcuts({
      t: () => document.getElementById('theme-toggle')?.click(),
      h: () => { window.location.href = '/'; },
      u: () => { window.location.href = '/upload-portal/'; },
      x: () => { if (authed) logout(); }
    });
  });
</script>

<div class="page">
  <header class="suite-header">
    <h1 class="name">upload-portal owner</h1>
    <div class="head-row">
      <p class="tagline dim">credentials, storage, activity log<span class="cursor" aria-hidden="true">█</span></p>
      <nav class="bracket-nav" aria-label="theme and account">
        <a href="/"><span class="key" aria-hidden="true">[h]</span> wdps</a>
        <a href="/upload-portal/"><span class="key" aria-hidden="true">[u]</span> upload</a>
        {#if authed}
          <button type="button" onclick={logout}><span class="key" aria-hidden="true">[x]</span> log out</button>
        {/if}
        <ThemeToggle />
      </nav>
    </div>
  </header>

  {#if checking}
    <p class="dim">checking…</p>
  {:else if !authed}
    <section class="panel">
      <h2><span class="bracket" aria-hidden="true">[ </span>owner login<span class="bracket" aria-hidden="true"> ]</span></h2>
      <p class="dim">restricted to one github account.</p>
      {#if hashMessage}<p class="danger">{hashMessage}</p>{/if}
      <p class="links"><a class="btn" href="/api/owner-login">login with github</a></p>
    </section>
  {:else}
    <section class="panel">
      <h2><span class="bracket" aria-hidden="true">[ </span>reset credentials<span class="bracket" aria-hidden="true"> ]</span></h2>
      <PasscodeResetForm role="admin" label="admin" />
      <PasscodeResetForm role="member" label="member" />
    </section>

    <LogView />
    <WipePanel />
  {/if}

  <footer class="suite-footer">
    <p><span aria-hidden="true">☼ </span>wdps · <span id="year">1970</span><span aria-hidden="true"> ☼</span></p>
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
  .links {
    margin-top: 1rem;
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
