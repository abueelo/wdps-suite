<script lang="ts">
  import { getStoredTheme, toggleTheme, type Theme } from '../theme.js';

  let theme = $state<Theme>('dark');

  $effect(() => {
    theme = getStoredTheme();
  });

  function handleClick() {
    theme = toggleTheme(theme);
  }
</script>

<button id="theme-toggle" type="button" aria-label="toggle light/dark theme" onclick={handleClick}>
  <span class="key" aria-hidden="true">[t]</span> <span class="mode">{theme === 'dark' ? 'light' : 'dark'}</span>
</button>
