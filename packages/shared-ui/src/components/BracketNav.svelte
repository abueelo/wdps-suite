<script lang="ts">
  // Renders "[key] label" — either as a link (href set) or a button
  // (onclick set), matching russl.dev's nav pattern.
  let {
    shortcutKey,
    label,
    href = undefined,
    onclick = undefined,
    current = false
  }: {
    shortcutKey: string;
    label: string;
    href?: string;
    onclick?: () => void;
    current?: boolean;
  } = $props();
</script>

{#if href}
  <a {href} aria-current={current ? 'page' : undefined}>
    <span class="key" aria-hidden="true">[{shortcutKey}]</span> {label}
  </a>
{:else}
  <button type="button" {onclick} aria-current={current ? 'page' : undefined}>
    <span class="key" aria-hidden="true">[{shortcutKey}]</span> {label}
  </button>
{/if}
