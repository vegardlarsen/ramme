<script>
  import { clock, calendar } from '$lib/data.svelte.js';
  import { calendarView } from '$lib/modules.js';

  let { panel } = $props();
  const v = $derived(calendarView({ calendar: calendar.v, now: clock.now }));
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const tag = (e) => e.label && e.label !== 'privat' ? ` · ${e.label}` : '';
</script>

<div class="row">
  {#each v.items as p (p.name)}
    <div class="card" style="background: {panel}">
      <div class="name" style="color: {p.color}">{p.name}{v.tomorrow ? ' · i morgen' : ''}</div>
      {#each p.events as e}
        <div class="ev">{e.allDay ? `${e.title}${tag(e)}` : `${hhmm(e.start)} ${e.title}${tag(e)}`}</div>
      {:else}
        <div class="ev">Ingen avtaler</div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .row { min-height: 170px; display: flex; gap: 18px; flex: 1; }
  .card { flex: 1; border-radius: 28px; padding: 24px 28px; transition: background 2s; }
  .name { font-size: 24px; font-weight: 700; }
  .ev { font-size: 23px; opacity: 0.75; margin-top: 8px; }
</style>
