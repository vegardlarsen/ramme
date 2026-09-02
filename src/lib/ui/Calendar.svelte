<script>
  import { clock, calendar } from '$lib/data.svelte.js';
  import { calendarView } from '$lib/modules.js';

  let { panel } = $props();
  const v = $derived(calendarView({ calendar: calendar.v, now: clock.now }));
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const tag = (e) => e.label && e.label !== 'privat' ? ` · ${e.label}` : '';
  const pct = (f) => `${f * 100}%`;
</script>

<div class="wrap">
  <div class="head">{v.tomorrow ? 'I morgen' : 'I dag'}</div>
  <div class="card" style="background: {panel}">
    <div class="names">
      <div class="gutter"></div>
      {#each v.items as p (p.name)}
        <div class="name">
          {p.name}
          {#each p.allDay as e}<span class="chip">{e.title}{tag(e)}</span>{/each}
        </div>
      {/each}
    </div>
    {#if v.hours.length}
      <div class="grid">
        <div class="gutter">
          {#each v.hours as h}
            <div class="hour" style="top: {pct(h.frac)}">{h.label}</div>
          {/each}
        </div>
        {#each v.items as p (p.name)}
          <div class="col">
            {#each v.hours as h}
              <div class="line" style="top: {pct(h.frac)}"></div>
            {/each}
            {#each p.timed as e}
              <div class="ev" class:done={e.done} class:now={e.now}
                   style="top: {pct(e.top)}; height: {pct(e.height)};
                          left: {pct(e.lane / e.lanes)}; width: {pct(1 / e.lanes)};
                          --pc: {p.color ?? 'currentColor'}">
                {hhmm(e.start)} {e.title}{tag(e)}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .wrap { flex: 1; display: flex; flex-direction: column; }
  .head { font-size: 22px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
          opacity: 0.6; margin-bottom: 14px; }
  .card { flex: 1; display: flex; flex-direction: column;
          border-radius: 28px; padding: 26px 28px 24px; transition: background 2s; }
  .names, .grid { display: flex; gap: 14px; }
  .gutter { flex: 0 0 44px; position: relative; }
  .name { flex: 1; font-size: 24px; font-weight: 700; margin-bottom: 20px;
          display: flex; align-items: baseline; gap: 10px; }
  .chip { font-size: 18px; font-weight: 600; opacity: 0.75; border: 1.5px solid currentColor;
          border-radius: 999px; padding: 1px 12px; white-space: nowrap; }
  .grid { flex: 1; min-height: 0; }
  .hour { position: absolute; right: 6px; transform: translateY(-50%);
          font-size: 16px; font-variant-numeric: tabular-nums; opacity: 0.45; }
  .col { flex: 1; position: relative; }
  .line { position: absolute; left: 0; right: 0; border-top: 1.5px solid currentColor; opacity: 0.12; }
  .ev { position: absolute; box-sizing: border-box; overflow: hidden; border-radius: 10px;
        min-height: 29px; padding: 2px 10px 2px 8px; font-size: 19px; font-weight: 600;
        line-height: 1.3; white-space: nowrap; text-overflow: ellipsis;
        border-left: 4px solid var(--pc);
        background: color-mix(in srgb, var(--pc) 22%, transparent); }
  .ev.done { opacity: 0.4; text-decoration: line-through; }
  .ev.now { background: color-mix(in srgb, var(--pc) 45%, transparent);
            box-shadow: inset 0 0 0 2.5px var(--pc); }
</style>
