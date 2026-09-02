<script lang="ts">
  // A repeating box-drawing rule, sized to the container via CSS overflow
  // rather than a fixed character count, so it never wraps oddly.
  let { char = '▒' }: { char?: string } = $props();
  let line = $derived(char.repeat(200));
</script>

<div class="divider" aria-hidden="true">{line}</div>
