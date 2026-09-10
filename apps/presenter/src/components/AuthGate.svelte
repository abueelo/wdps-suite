<script lang="ts">
  import { LOGIN_URL } from '../lib/auth/ownerAuth.js';
</script>

<section class="panel">
  <h2><span class="bracket" aria-hidden="true">[ </span>owner login required<span class="bracket" aria-hidden="true"> ]</span></h2>
  <p class="warn">presenter is under development — owner login only for now.</p>
  <p class="dim">same GitHub login as the upload-portal owner console.</p>
  <p class="login-row">
    <a class="btn primary" href={LOGIN_URL}><span class="key" aria-hidden="true">[l]</span> log in with GitHub</a>
  </p>
</section>

<style>
  .login-row {
    margin-top: 1.25rem;
  }
</style>
