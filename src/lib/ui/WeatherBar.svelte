<script>
  import { clock, weather, nowcast } from '$lib/data.svelte.js';
  import { rainAhead, nowcastHeadline, nowcastPath, currentSub } from '$lib/modules.js';

  let { panel } = $props();
  const w = $derived(weather.v);
  const pts = $derived(nowcast.v ?? []);
  const rain = $derived(rainAhead({ nowcast: pts }));
  const line = $derived(nowcastPath(pts));
</script>

{#if w}
  <div class="bar">
    {#if rain}
      <div class="now rain">
        <div class="head">
          <img src="/weather/{w.current.symbol}.svg" alt="" width="44" height="44" />
          <span class="temp">{w.current.temp}°</span>
          <span class="sub">{nowcastHeadline(pts) || 'regn neste 90 min'}</span>
        </div>
        <div class="graph">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="{line} L 100 100 L 0 100 Z" fill="#6fb9ea" opacity="0.6" />
            <path d={line} fill="none" stroke="currentColor" stroke-width="2.5"
                  stroke-opacity="0.85" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          </svg>
          <div class="ticks"><span>nå</span><span>30</span><span>60</span><span>90</span></div>
        </div>
      </div>
    {:else}
      <div class="now">
        <img src="/weather/{w.current.symbol}.svg" alt="" width="84" height="84" />
        <div>
          <div class="temp big">{w.current.temp}°</div>
          <div class="sub">{currentSub(w, clock.now)}</div>
        </div>
      </div>
    {/if}
    <div class="hours">
      {#each w.hourly as h}
        <div class="item">
          <span class="t">{h.hour}</span>
          <img src="/weather/{h.symbol}.svg" alt="" width="56" height="56" />
          <span class="htemp">{h.temp}°</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* full-bleed: cancel the page's 48px side and top padding so the bar sits on
     the top edge (assumes weatherbar is the first module) */
  .bar { flex: 1; margin: -48px -48px 0; height: 170px; box-sizing: border-box;
         padding: 22px 28px; display: flex; align-items: center; gap: 28px;
         transition: background 2s; }
  .now { flex: none; display: flex; align-items: center; gap: 12px;
         padding-right: 28px; border-right: 1.5px solid color-mix(in srgb, currentColor 15%, transparent); }
  .now.rain { width: 320px; height: 100%; flex-direction: column; align-items: stretch; gap: 6px; }
  .head { display: flex; align-items: center; gap: 8px; }
  .temp { font-size: 36px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .temp.big { font-size: 50px; line-height: 1.05; }
  .sub { font-size: 20px; opacity: 0.7; white-space: nowrap; }
  .head .sub { margin-left: 4px; }
  .graph { flex: 1; position: relative; }
  svg { position: absolute; inset: 0 0 20px; width: 100%; height: calc(100% - 20px); }
  .ticks { position: absolute; bottom: 0; left: 0; right: 0; display: flex;
           justify-content: space-between; font-size: 15px; opacity: 0.55; }
  .hours { flex: 1; display: flex; justify-content: space-between; }
  .item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .t { font-size: 21px; opacity: 0.6; }
  .htemp { font-size: 25px; font-weight: 600; }
</style>
