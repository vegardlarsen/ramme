<script>
  import { departures, clock, weather } from '$lib/data.svelte.js';
  import { hourOf } from '$lib/modules.js';
  import { isDaylight } from '$lib/sky.js';

  let { panel } = $props();
  const evening = $derived(!isDaylight(hourOf(clock.now), weather.v));
  const accent = $derived(evening ? '#FFB86B' : '#C4572E');

  const hhmm = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const wd = (iso) => new Date(iso).toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '');

  const groups = $derived((departures.v ?? [])
    .filter((g) => g.calls.length || (g.alert && g.situations.length))
    .map((g) => {
      let prevDay = clock.now.toDateString();
      return { ...g, calls: g.calls.map((c) => {
        const day = new Date(c.expected).toDateString();
        const prefix = day === prevDay ? '' : `${wd(c.expected)} `;
        prevDay = day;
        return { ...c, text: prefix + hhmm(c.cancelled ? c.aimed : c.expected),
                 delayed: !c.cancelled && new Date(c.expected) - new Date(c.aimed) >= 120_000 };
      }) };
    }));
  const notices = $derived(groups.filter((g) => g.alert).flatMap((g) => g.situations));
</script>

{#if groups.length}
  <div class="strip" class:alert={notices.length} style="background: {panel}; --accent: {accent}">
    <div class="row">
      {#each groups as g (g.label)}
        <div class="group">
          <span class="label">{g.label}</span>
          {#each g.calls as c, i}
            <span class="t" class:first={i === 0} class:delayed={c.delayed} class:cancelled={c.cancelled}>{c.text}</span>
          {/each}
        </div>
      {/each}
    </div>
    {#each notices as n}
      <div class="notice">{n}</div>
    {/each}
  </div>
{/if}

<style>
  .strip { border-radius: 32px; padding: 20px 40px; box-sizing: border-box; flex: 1; transition: background 2s; }
  .strip.alert { border: 1.5px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  .row { display: flex; justify-content: space-between; align-items: baseline; }
  .group { display: flex; gap: 18px; align-items: baseline; font-size: 24px; font-variant-numeric: tabular-nums; }
  .label { font-size: 21px; opacity: 0.55; }
  .t { opacity: 0.75; }
  .t.first { opacity: 1; font-weight: 600; }
  .t.delayed { color: var(--accent); opacity: 1; }
  .t.cancelled { text-decoration: line-through; opacity: 0.45; }
  .notice { margin-top: 12px; padding-top: 12px; font-size: 21px; color: var(--accent);
            border-top: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
</style>
