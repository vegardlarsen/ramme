<script>
  import { clock } from '$lib/data.svelte.js';
  const pad2 = (n) => String(n).padStart(2, '0');
  const weekday = $derived(clock.now.toLocaleDateString('nb-NO', { weekday: 'long' }));
  const date = $derived(clock.now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }));
</script>

<div class="row">
  <div class="clock">{pad2(clock.now.getHours())}:{pad2(clock.now.getMinutes())}</div>
  <div class="day">
    <div class="weekday">{weekday[0].toUpperCase() + weekday.slice(1)}</div>
    <div class="date">{date}</div>
  </div>
</div>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; gap: 40px; }
  .clock { font-size: 175px; font-weight: 300; line-height: 0.95; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .day { text-align: right; }
  .weekday { font-size: 64px; font-weight: 600; line-height: 1.05; }
  .date { font-size: 34px; opacity: 0.7; }
</style>
