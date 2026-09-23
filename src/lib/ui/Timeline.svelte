<script>
  import { clock, calendar } from '$lib/data.svelte.js';
  import { timelineView, LANE } from '$lib/modules.js';

  let { panel } = $props();
  const v = $derived(timelineView({ calendar: calendar.v, now: clock.now }));
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const tag = (e) => e.label && e.label !== 'privat' ? ` · ${e.label}` : '';
  const pct = (f) => `${f * 100}%`;
  const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const lanes = (p) => Math.max(1, ...p.timed.map((e) => e.lanes));
</script>

<div class="wrap">
  <div class="head">{v.tomorrow ? 'I morgen' : 'I dag'}</div>
  <div class="card">
    {#if v.ticks.length}
      <div class="row axis">
        <div class="name"></div>
        <div class="track">
          {#each v.ticks as t}<div class="tick" style="left: {pct(t.frac)}">{t.label}</div>{/each}
        </div>
      </div>
      <!-- one layer under all rows, so lines and cuts run unbroken top to bottom -->
      <div class="grid">
        {#each v.ticks as t}<div class="line" style="left: {pct(t.frac)}"></div>{/each}
        {#each v.breaks as b}<div class="break" style="left: {pct(b.left)}; width: {pct(b.width)}"></div>{/each}
      </div>
    {/if}
    {#each v.items as p (p.name)}
      <div class="row">
        <div class="name" title={p.name}
             style="background: color-mix(in srgb, {p.color ?? 'currentColor'} 35%, transparent);
                    border-color: {p.color ?? 'currentColor'}">{initials(p.name)}</div>
        <div class="body">
        {#if p.allDay.length}
          <div class="chips">{#each p.allDay as e}<span class="chip">{e.title}{tag(e)}</span>{/each}</div>
        {/if}
        <div class="track" style="height: {lanes(p) * LANE}px">
          {#each p.timed as e}
            <div class="ev" class:done={e.done} class:now={e.now}
                 style="left: {pct(e.left)}; width: {pct(e.width)};
                        top: {pct(e.lane / e.lanes)}; height: {pct(1 / e.lanes)};
                        --pc: {p.color ?? 'currentColor'}"></div>
            <div class="label" class:done={e.done}
                 style="left: {pct(e.left)}; width: {pct(e.room)};
                        top: {pct(e.lane / e.lanes)}; height: {pct(1 / e.lanes)}">
              <span class="t">{hhmm(e.start)}</span>
              <span class="title">{e.title}{tag(e)}</span>
            </div>
          {/each}
        </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* full-bleed: cancel the page's 48px side and bottom padding so the band gets
     the width and sits on the screen edge (assumes timeline is the last module) */
  .wrap { flex: 1; display: flex; flex-direction: column; margin: 0 -48px -48px; }
  .head { padding: 0 48px; font-size: 22px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
          opacity: 0.6; margin-bottom: 14px; }
  .card { position: relative; display: flex; flex-direction: column; gap: 10px;
          padding: 20px 28px 24px; transition: background 2s; }
  .row { display: flex; gap: 14px; align-items: center; }
  .name { flex: 0 0 50px; height: 50px; box-sizing: border-box; border-radius: 50%;
          border: 2.5px solid; display: grid; place-items: center;
          font-size: 19px; font-weight: 700; letter-spacing: 0.02em; }
  .axis .name { height: 0; border: 0; }
  .body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 15px; font-weight: 600; opacity: 0.75; border: 1.5px solid currentColor;
          border-radius: 999px; padding: 0 10px; white-space: nowrap; }
  .track { flex: 1 0 auto; position: relative; }
  .axis .track { height: 22px; }
  .tick { position: absolute; transform: translateX(-50%);
          font-size: 16px; font-variant-numeric: tabular-nums; opacity: 0.45; }
  /* track area: below the axis row (padding + axis + gap), right of the avatars */
  .grid { position: absolute; top: 47px; bottom: 19px; left: calc(28px + 50px + 14px); right: 28px; }
  .line { position: absolute; top: 0; bottom: 0; border-left: 1.5px solid currentColor; opacity: 0.12; }
  /* cut-out stretch of empty time */
  .break { position: absolute; top: 0; bottom: 0; opacity: 0.15;
           background: repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 9px); }
  .ev { position: absolute; box-sizing: border-box; border-radius: 10px;
        min-width: 8px; border: 2px solid transparent;
        border-left: 4px solid var(--pc); background-clip: padding-box;
        background-color: color-mix(in srgb, var(--pc) 22%, transparent); }
  .label { position: absolute; box-sizing: border-box; padding: 0 6px 0 11px;
           display: flex; flex-direction: column; justify-content: center;
           font-size: 17px; font-weight: 600; line-height: 1.2; }
  .label span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t { font-size: 14px; opacity: 0.7; font-variant-numeric: tabular-nums; }
  .ev.done, .label.done { opacity: 0.4; }
  .label.done .title { text-decoration: line-through; }
  .ev.now { background-color: color-mix(in srgb, var(--pc) 45%, transparent);
            box-shadow: inset 0 0 0 2.5px var(--pc); }
</style>
