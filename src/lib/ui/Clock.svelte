<script>
  import { clock } from '$lib/data.svelte.js';
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateLine = $derived(
    clock.now.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }),
  );
</script>

<div>
  <div class="clock">{pad2(clock.now.getHours())}:{pad2(clock.now.getMinutes())}</div>
  <div class="date">{dateLine[0].toUpperCase() + dateLine.slice(1)}</div>
</div>

<style>
  .clock { font-size: 175px; font-weight: 300; line-height: 0.95; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .date { font-size: 30px; margin-top: 16px; opacity: 0.75; }
</style>
