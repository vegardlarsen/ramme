<script>
  import { clock, cfg } from '$lib/data.svelte.js';
  import { activeReminder } from '$lib/reminders.js';
  import { hourOf } from '$lib/modules.js';
  import { mode } from '$lib/sky.js';

  const r = $derived(activeReminder(cfg.v?.reminders ?? [], clock.now));
  const evening = $derived(mode(hourOf(clock.now)) === 'evening');
</script>

{#if r}
  <div class="center">
    <div class="card" class:evening>
      <div class="label">{r.label}</div>
      <div class="title">{r.title}</div>
      {#if r.subtitle}<div class="sub">{r.subtitle}</div>{/if}
    </div>
  </div>
{/if}

<style>
  .center { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .card { background: rgba(255,255,255,0.7); border-radius: 44px; padding: 64px; color: #3A2A20; }
  .label { font-size: 24px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: #C4572E; }
  .title { font-size: 96px; font-weight: 700; line-height: 1.05; margin-top: 14px; }
  .sub { font-size: 30px; margin-top: 14px; opacity: 0.7; }
  .card.evening { background: rgba(255,184,107,0.14); border: 1.5px solid rgba(255,184,107,0.35); color: #F1ECFA; }
  .card.evening .label { color: #FFB86B; }
</style>
