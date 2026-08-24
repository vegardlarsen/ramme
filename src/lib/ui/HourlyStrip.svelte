<script>
  import { weather } from '$lib/data.svelte.js';
  let { panel } = $props();
</script>

{#if weather.v}
  <div class="strip" style="background: {panel}">
    {#each weather.v.hourly as h}
      <div class="item">
        <span class="t">{h.hour}</span>
        <img src="/weather/{h.symbol}.svg" alt="" width="64" height="64" />
        <span class="temp">{h.temp}°</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .strip { border-radius: 32px; padding: 26px 40px; height: 185px; box-sizing: border-box; display: flex; justify-content: space-between; flex: 1; transition: background 2s; }
  .item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .t { font-size: 21px; opacity: 0.6; }
  .temp { font-size: 25px; font-weight: 600; }
</style>
