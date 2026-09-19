<script>
  import { fade } from 'svelte/transition';
  import Clock from '$lib/ui/Clock.svelte';
  import CurrentWeather from '$lib/ui/CurrentWeather.svelte';
  import HourlyStrip from '$lib/ui/HourlyStrip.svelte';
  import Nowcast from '$lib/ui/Nowcast.svelte';
  import Reminder from '$lib/ui/Reminder.svelte';
  import Photos from '$lib/ui/Photos.svelte';
  import Calendar from '$lib/ui/Calendar.svelte';
  import { clock, weather, nowcast, calendar, photos, cfg } from '$lib/data.svelte.js';
  import { layoutModules, hourOf } from '$lib/modules.js';
  import { calendarReminders } from '$lib/reminders.js';
  import { themeAt } from '$lib/sky.js';

  const COMPONENTS = {
    clock: Clock, weather: CurrentWeather, hourly: HourlyStrip, nowcast: Nowcast,
    reminder: Reminder, photos: Photos, calendar: Calendar,
  };

  let vw = $state(1080), vh = $state(1920);
  const scale = $derived(Math.min(vw / 1080, vh / 1920));

  const h = $derived(hourOf(clock.now));
  const theme = $derived(themeAt(h, weather.v));

  const ctx = $derived({
    weather: weather.v, nowcast: nowcast.v, calendar: calendar.v,
    photos: photos.v?.photos ?? [],
    reminders: calendarReminders(calendar.v),
    now: clock.now,
  });
  const rows = $derived(layoutModules(cfg.v?.modules ?? [], ctx));
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div class="viewport">
  <div class="stage" style="transform: scale({scale}); color: {theme.text}">
    <div class="sky" style="background: {theme.sky}"></div>
    <div class="content">
      {#each rows as row (row.map((m) => m.name).join())}
        <div class="mrow" class:grow={row.some((m) => m.flex)}
             style={row.some((m) => m.flex) ? `height: ${Math.max(...row.map((m) => m.maxHeight ?? m.minHeight))}px` : null}
             transition:fade={{ duration: 1000 }}>
          {#each row as m (m.name)}
            {@const C = COMPONENTS[m.name]}
            <C panel={theme.panel} maxHeight={m.maxHeight ?? m.minHeight} />
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  :global(body) { margin: 0; background: #141828; overflow: hidden; cursor: none; }
  .viewport { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
  .stage { width: 1080px; height: 1920px; flex: none; position: relative; overflow: hidden;
           font-family: 'Outfit', sans-serif; transition: color 2s; transform-origin: center; }
  .sky { position: absolute; inset: 0; transition: background 2s; }
  .content { position: absolute; inset: 0; padding: 72px; display: flex; flex-direction: column;
             gap: 36px; box-sizing: border-box; }
  .mrow { display: flex; gap: 18px; justify-content: space-between; align-items: flex-start; }
  /* Flexible rows render at their budgeted height; the first one pulls itself and
     every later row to the bottom of the screen, leaving open sky above. */
  .mrow.grow { margin-top: auto; align-items: stretch; flex: none; }
  .mrow.grow ~ .mrow.grow { margin-top: 0; }
  /* Only sizing here — components own their internal display (Photos is a grid). */
  .mrow.grow > :global(*) { flex: 1; }
</style>
