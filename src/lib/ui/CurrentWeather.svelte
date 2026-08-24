<script>
  import Icon from './Icon.svelte';
  import { clock, weather } from '$lib/data.svelte.js';
  import { hourOf } from '$lib/modules.js';
  import { mode } from '$lib/sky.js';

  let { panel } = $props();
  const w = $derived(weather.v);
  const m = $derived(mode(hourOf(clock.now)));
  const sub = $derived(
    !w ? '' :
    m === 'morning' ? `${w.current.text} · ↑ ${w.sunrise}` :
    m === 'day' ? `${w.current.text} · ${w.current.precip} mm` :
    `${w.current.text} · ↓ ${w.sunset}`,
  );
</script>

{#if w}
  <div class="panel" style="background: {panel}">
    <Icon name={w.current.icon} size={58} />
    <div class="temp">{w.current.temp}°</div>
    <div class="sub">{sub}</div>
  </div>
{/if}

<style>
  .panel { border-radius: 36px; padding: 30px 38px; text-align: center; min-width: 210px; transition: background 2s; }
  .temp { font-size: 50px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .sub { font-size: 22px; opacity: 0.7; }
</style>
