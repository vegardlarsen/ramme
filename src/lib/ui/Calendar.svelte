<script>
  import { clock, calendar } from '$lib/data.svelte.js';
  import { calendarView } from '$lib/modules.js';

  let { panel } = $props();
  const v = $derived(calendarView({ calendar: calendar.v, now: clock.now }));
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const tag = (e) => e.label && e.label !== 'privat' ? ` · ${e.label}` : '';
</script>

<div class="wrap">
  <div class="head">{v.tomorrow ? 'I morgen' : 'I dag'}</div>
  <div class="row">
    {#each v.items as p (p.name)}
      <div class="card" style="background: {panel}">
        <div class="name">{p.name}</div>
        {#each p.events as e}
          <div class="ev">{e.allDay ? `${e.title}${tag(e)}` : `${hhmm(e.start)} ${e.title}${tag(e)}`}</div>
        {:else}
          <div class="ev">Ingen avtaler</div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .wrap { flex: 1; }
  .head { font-size: 22px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
          opacity: 0.6; margin-bottom: 14px; }
  .row { min-height: 170px; display: flex; gap: 18px; }
  .card { flex: 1; border-radius: 28px; padding: 24px 28px; transition: background 2s; }
  .name { font-size: 24px; font-weight: 700; }
  .ev { font-size: 23px; opacity: 0.75; margin-top: 8px; }
</style>
