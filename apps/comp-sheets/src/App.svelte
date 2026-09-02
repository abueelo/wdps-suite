<script lang="ts">
  import { Divider, ThemeToggle } from '@wdps/shared-ui';
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
  }
</script>

<div class="page">
  <header class="suite-header">
    <div>
      <p class="wordmark">comp-sheets<span class="cursor" aria-hidden="true">_</span></p>
      <p class="tagline dim">rename &amp; export competition entries, entirely in your browser</p>
    </div>
    <nav class="bracket-nav" aria-label="theme and suite">
      <a href="/">wdps</a>
      <ThemeToggle />
    </nav>
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
    <ExportStep onBack={() => goTo(3)} />
  {/if}
</div>

<style>
  .wordmark {
    font-size: 1.3rem;
    letter-spacing: 0.1em;
  }
  .wordmark .cursor {
    color: var(--amber);
    animation: blink 1.2s steps(1) infinite;
  }
  @keyframes blink {
    50% { opacity: 0; }
  }
  .tagline {
    margin-top: 0.35rem;
  }
  .step-nav button.current {
    color: var(--amber);
  }
  .step-nav button {
    text-decoration: none;
  }
</style>
