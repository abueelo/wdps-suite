<script lang="ts">
  import type { LiveSession } from '../lib/types.js';
  import { exportProjectFile } from '../lib/export/projectFile.js';
  import { saveBlob } from '../lib/export/download.js';

  let { session }: { session: LiveSession } = $props();

  let tournamentName = $state('tournament');
  let status = $state('');
  let busy = $state(false);

  export async function saveProject() {
    busy = true;
    status = 'building project file…';
    try {
      const blob = await exportProjectFile(session);
      await saveBlob(`${tournamentName}.wdps-knockout.zip`, blob);
      status = 'project saved.';
    } catch (err) {
      status = err instanceof Error ? err.message : 'failed to save project';
    } finally {
      busy = false;
    }
  }
</script>

<details class="panel">
  <summary><span class="bracket" aria-hidden="true">[ </span>export<span class="bracket" aria-hidden="true"> ]</span></summary>

  <div class="field">
    <label for="tournament-name">tournament name</label>
    <input
      id="tournament-name"
      type="text"
      value={tournamentName}
      oninput={(e) => (tournamentName = (e.currentTarget as HTMLInputElement).value)}
    />
  </div>

  <div class="actions">
    <button type="button" class="btn primary" disabled={busy} onclick={saveProject}>
      <span class="key" aria-hidden="true">[s]</span> save project
    </button>
  </div>

  {#if status}<p class="dim">{status}</p>{/if}
</details>

<style>
  .field {
    margin-top: 1rem;
  }
  .field input[type='text'] {
    display: block;
    margin-top: 0.3rem;
    width: 24ch;
  }
  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
</style>
