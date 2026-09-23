<script>
  import { nowcast, weather } from '$lib/data.svelte.js';
  import { nowcastHeadline, nowcastPath } from '$lib/modules.js';
  let { panel } = $props();
  const pts = $derived(nowcast.v ?? []);
  const w = $derived(weather.v);
  const sub = $derived(nowcastHeadline(pts) || 'regn neste 90 min');
  // 100x100 viewBox stretched to fit; non-scaling stroke keeps the line crisp.
  const line = $derived(nowcastPath(pts));
</script>

<div class="panel" style="background: {panel}">
  <div class="head">
    {#if w}
      <img src="/weather/{w.current.symbol}.svg" alt="" width="56" height="56" />
      <span class="temp">{w.current.temp}°</span>
    {/if}
  </div>
  <div class="sub">{sub}</div>
  <div class="graph">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="{line} L 100 100 L 0 100 Z" fill="#6fb9ea" opacity="0.6" />
      <path d={line} fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-opacity="0.85" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </svg>
    <div class="ticks"><span>nå</span><span>30</span><span>60</span><span>90</span></div>
  </div>
</div>

<style>
  .panel { position: relative; border-radius: 36px; min-width: 300px; height: 270px;
           box-sizing: border-box; padding: 24px 32px 0; overflow: hidden;
           text-align: center; transition: background 2s; }
  .head { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .temp { font-size: 44px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .sub { font-size: 20px; opacity: 0.7; margin-top: 2px; }
  .graph { position: absolute; left: 0; right: 0; bottom: 0; height: 50%; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ticks { position: absolute; bottom: 8px; left: 24px; right: 24px; display: flex;
           justify-content: space-between; font-size: 15px; opacity: 0.55; }
</style>
