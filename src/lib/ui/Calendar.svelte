<script>
  import { clock, calendar, weather } from '$lib/data.svelte.js';
  import { calendarView } from '$lib/modules.js';

  let { panel } = $props();
  const v = $derived(calendarView({ calendar: calendar.v, now: clock.now }));
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const tag = (e) => e.label && e.label !== 'privat' ? ` · ${e.label}` : '';
</script>

<div class="row">
  {#if v.mode === 'morning'}
    {#each v.items as p}
      <div class="card" style="background: {panel}">
        <div class="name" style="color: {p.color}">{p.name}</div>
        <div class="ev">{p.next ? `${hhmm(p.next.start)} ${p.next.title}${tag(p.next)}` : 'Ingen avtaler'}</div>
      </div>
    {/each}
  {:else if v.mode === 'day'}
    {#each v.items as e}
      <div class="chip" style="background: {panel}"><b>{hhmm(e.start)}</b> {e.title} · {e.who}{tag(e)}</div>
    {/each}
  {:else}
    {#each v.items as e}
      <div class="wide" style="background: {panel}">
        I morgen: <b>{e.title} · {e.who} {e.allDay ? '' : hhmm(e.start)}</b>
        {#if weather.v}· {weather.v.tomorrow.text}, {weather.v.tomorrow.temp}°{/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .row { height: 170px; display: flex; gap: 18px; align-items: flex-start; flex: 1; }
  .card { flex: 1; border-radius: 28px; padding: 24px 28px; transition: background 2s; }
  .name { font-size: 24px; font-weight: 700; }
  .ev { font-size: 23px; opacity: 0.75; margin-top: 8px; }
  .chip { border-radius: 28px; padding: 26px 32px; font-size: 27px; transition: background 2s; }
  .wide { border-radius: 28px; padding: 30px 38px; font-size: 27px; opacity: 0.9; width: 100%; box-sizing: border-box; transition: background 2s; }
</style>
