<script lang="ts">
  import { Divider, ThemeToggle } from '@wdps/shared-ui';
  import { bindShortcuts } from '@wdps/shared-ui/shortcuts';
  import { imagesStore } from './lib/state/images.svelte.js';
  import UploadStep from './components/steps/UploadStep.svelte';
  import ReviewStep from './components/steps/ReviewStep.svelte';
  import SettingsStep from './components/steps/SettingsStep.svelte';
  import ExportStep from './components/steps/ExportStep.svelte';

  type StepId = 1 | 2 | 3 | 4;
  let step = $state<StepId>(1);

  const steps: { id: StepId; key: string; label: string }[] = [
    { id: 1, key: '1', label: 'upload' },
    { id: 2, key: '2', label: 'review' },
    { id: 3, key: '3', label: 'settings' },
    { id: 4, key: '4', label: 'export' }
  ];

  function goTo(id: StepId) {
    step = id;
    window.scrollTo(0, 0);
  }

  $effect(() => {
    return bindShortcuts({
      '1': () => goTo(1),
      '2': () => { if (imagesStore.all.length > 0) goTo(2); },
      '3': () => { if (imagesStore.all.length > 0) goTo(3); },
      '4': () => { if (imagesStore.all.length > 0) goTo(4); },
      t: () => document.getElementById('theme-toggle')?.click(),
      h: () => { window.location.href = '/'; }
    });
  });
</script>

<div class="page">
  <header class="suite-header">
    <pre class="name" aria-hidden="true" style="--banner-cols: 30;">█▀▀ █▀█ █▄ ▄█ █▀█  ▄▀▀ █ █ █▀▀ █▀▀ ▀█▀ ▄▀▀
█▄▄ █▄█ █ ▀ █ █▀▀  ▄██ █▀█ ██▄ ██▄  █  ▄██</pre>
    <h1 class="visually-hidden">comp-sheets</h1>
    <div class="head-row">
      <p class="tagline dim">rename &amp; export competition entries<span class="cursor" aria-hidden="true">█</span></p>
      <nav class="bracket-nav" aria-label="theme and suite">
        <a href="/"><span class="key" aria-hidden="true">[h]</span> wdps</a>
        <ThemeToggle />
      </nav>
    </div>
  </header>

  <nav class="bracket-nav step-nav" aria-label="steps">
    {#each steps as s}
      <button
        type="button"
        class:current={step === s.id}
        disabled={s.id > 1 && imagesStore.all.length === 0}
        onclick={() => goTo(s.id)}
      >
        <span class="key" aria-hidden="true">[{s.key}]</span> {s.label}
      </button>
    {/each}
  </nav>

  <Divider />

  {#if step === 1}
    <UploadStep onNext={() => goTo(2)} />
  {:else if step === 2}
    <ReviewStep onNext={() => goTo(3)} onBack={() => goTo(1)} />
  {:else if step === 3}
    <SettingsStep onNext={() => goTo(4)} onBack={() => goTo(2)} />
  {:else if step === 4}
    <ExportStep onBack={() => goTo(3)} onBackToStart={() => goTo(1)} />
  {/if}

  <footer class="suite-footer">
    <p><span aria-hidden="true">☼ </span><a class="edit-link" href="/upload-portal/owner.html"><span class="swap">abueelo</span></a> · <span id="year">1970</span><span aria-hidden="true"> ☼</span></p>
  </footer>
</div>

<style>
  .tagline {
    margin-top: 0.75rem;
  }
  .step-nav button.current {
    color: var(--amber);
  }
  .step-nav button {
    text-decoration: none;
  }
</style>
