<script lang="ts">
  import { getSettings, putSettings } from '../../lib/api/client.js';
  import type { PortalSettings } from '../../lib/types.js';

  let settings = $state<PortalSettings | null>(null);
  let saving = $state(false);

  $effect(() => {
    getSettings().then((s) => (settings = s));
  });

  async function toggle() {
    if (!settings) return;
    saving = true;
    try {
      settings = await putSettings({ memberGateEnabled: !settings.memberGateEnabled });
    } finally {
      saving = false;
    }
  }
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>settings<span class="bracket" aria-hidden="true"> ]</span></h2>
  {#if settings}
    <label class="check-row">
      <input type="checkbox" checked={settings.memberGateEnabled} onchange={toggle} disabled={saving} />
      require a member passcode to upload
    </label>
    <p class="dim">
      {settings.memberGateEnabled
        ? 'members need the club passcode (MEMBER_PASSCODE) before they can submit entries.'
        : 'off — anyone with the upload link can submit entries. turn this on once a club passcode is set.'}
    </p>
  {/if}
</section>

<style>
  .check-row {
    display: flex;
    align-items: center;
    gap: 0.6ch;
    margin-top: 1rem;
  }
</style>
