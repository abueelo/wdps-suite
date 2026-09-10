<script lang="ts">
  import { LOGIN_URL } from '../lib/auth/ownerAuth.js';
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>owner login required<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="warn">knockout is under development — owner login only for now.</p>
  <p class="dim">same GitHub login as the upload-portal owner console.</p>
  <p class="login-row">
    <a class="btn primary" href={LOGIN_URL}><span class="key" aria-hidden="true">[l]</span> log in with GitHub</a>
  </p>
</section>

<style>
  .login-row {
    margin-top: 1.25rem;
  }

  /* This panel isn't a clickable/collapsible affordance like other
     .panel uses across the suite — it's just a static message, so skip
     the shared hover highlight. */
  .panel:hover {
    border-color: var(--border);
  }
</style>
