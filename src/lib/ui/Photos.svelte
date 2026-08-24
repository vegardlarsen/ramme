<script>
  import { fade } from 'svelte/transition';
  import { clock, photos, cfg } from '$lib/data.svelte.js';

  const photo = $derived.by(() => {
    const list = photos.v?.photos ?? [];
    if (!list.length) return null;
    const ms = (cfg.v?.photoIntervalMinutes ?? 60) * 60_000;
    return list[Math.floor(+clock.now / ms) % list.length];
  });

  // "Sommerferie · Juli 2025" — caption from iCloud when set, month/year of the
  // photo as a memory cue.
  const caption = $derived.by(() => {
    if (!photo) return '';
    const when = photo.takenAt
      ? new Date(photo.takenAt).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
      : '';
    return [photo.caption, when && when[0].toUpperCase() + when.slice(1)]
      .filter(Boolean).join(' · ');
  });
</script>

{#if photo}
  <div class="frame">
    {#key photo.url}
      <img src={photo.url} alt="" in:fade={{ duration: 1500 }} out:fade={{ duration: 1500 }} />
    {/key}
    {#if caption}
      <div class="credit">{caption}</div>
    {/if}
  </div>
{/if}

<style>
  .frame { flex: 1; position: relative; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 44px; }
  .credit { position: absolute; left: 36px; bottom: 30px; font-size: 20px; color: rgba(255,255,255,0.85); text-shadow: 0 1px 8px rgba(0,0,0,0.5); }
</style>
