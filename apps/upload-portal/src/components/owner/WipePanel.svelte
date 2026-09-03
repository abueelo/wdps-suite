<script lang="ts">
  import { ConfirmModal } from '@wdps/shared-ui';
  import { ownerWipe } from '../../lib/api/client.js';
  import type { WipeResult } from '../../lib/types.js';

  let pendingScope = $state<'images' | 'full' | null>(null);
  let fullConfirmText = $state('');
  let busy = $state(false);
  let result = $state<WipeResult | null>(null);
  let error = $state('');

  async function doWipe() {
    if (busy || !pendingScope) return;
    busy = true;
    error = '';
    result = null;
    try {
      result = await ownerWipe(pendingScope);
      fullConfirmText = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'wipe failed';
    } finally {
      busy = false;
      pendingScope = null;
    }
  }
</script>

<section class="panel danger-panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>wipe storage<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="dim">both of these are permanent. neither can be undone.</p>

  <div class="wipe-row">
    <button type="button" class="btn danger-btn" onclick={() => (pendingScope = 'images')}>wipe images only</button>
    <span class="dim">deletes every uploaded image. competitions and entries stay — their thumbnails will 404.</span>
  </div>

  <div class="wipe-row">
    <label class="dim" for="full-confirm">type WIPE to enable</label>
    <input id="full-confirm" type="text" bind:value={fullConfirmText} autocomplete="off" placeholder="WIPE" />
    <button type="button" class="btn danger-btn" disabled={fullConfirmText !== 'WIPE'} onclick={() => (pendingScope = 'full')}>
      full reset
    </button>
    <span class="dim">deletes every competition, entry and image. a true clean slate.</span>
  </div>

  {#if result}
    <p class="ok">done — {result.imagesDeleted} images, {result.entriesAffected} entries across {result.competitionsAffected} competitions.</p>
  {/if}
  {#if error}<p class="danger">{error}</p>{/if}
</section>

{#if pendingScope}
  <ConfirmModal
    message={pendingScope === 'full'
      ? 'Delete every competition, entry, and image? This is a full reset — there is no undo.'
      : 'Delete every uploaded image? Competition and entry records stay, but their thumbnails will break. There is no undo.'}
    confirmLabel={busy ? 'wiping…' : 'wipe'}
    onConfirm={doWipe}
    onCancel={() => (pendingScope = null)}
  />
{/if}

<style>
  .danger-panel {
    border-color: var(--danger);
  }
  .wipe-row {
    display: flex;
    align-items: center;
    gap: 1ch;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .danger-btn:hover,
  .danger-btn:focus-visible {
    color: var(--danger);
    border-color: var(--danger);
  }
  #full-confirm {
    width: 8rem;
  }
</style>
