<script>
  import { clock, weather } from '$lib/data.svelte.js';
  import { currentSub } from '$lib/modules.js';

  let { panel } = $props();
  const w = $derived(weather.v);
  const sub = $derived(w ? currentSub(w, clock.now) : '');
</script>

{#if w}
  <div class="panel" style="background: {panel}">
    <img src="/weather/{w.current.symbol}.svg" alt="" width="116" height="116" />
    <div class="temp">{w.current.temp}°</div>
    <div class="sub">{sub}</div>
  </div>
{/if}

<style>
  .panel { border-radius: 36px; padding: 30px 38px; text-align: center; min-width: 210px; transition: background 2s; }
  .temp { font-size: 50px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .sub { font-size: 22px; opacity: 0.7; }
</style>
