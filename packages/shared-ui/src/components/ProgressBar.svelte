<script lang="ts">
  let { value, width = 24, label = '' }: { value: number; width?: number; label?: string } = $props();

  let pct = $derived(Math.max(0, Math.min(100, Math.round(value * 100))));
  let filled = $derived(Math.round((pct / 100) * width));
</script>

<div class="ascii-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || undefined}>
  <span class="bar">[{'█'.repeat(filled)}<span class="empty">{'░'.repeat(width - filled)}</span>]</span>
  <span class="pct">{pct}%</span>
  {#if label}<span class="dim">{label}</span>{/if}
</div>
