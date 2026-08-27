<script>
  import { fade } from 'svelte/transition';
  import { clock, photos, cfg } from '$lib/data.svelte.js';

  let { maxHeight = 500 } = $props();
  const W = 936; // content width: 1080 - 2×72 padding

  // Room decides orientation: tall space favors portrait shots, shallow space
  // landscape ones. Fall back to the whole album if nothing matches.
  const photo = $derived.by(() => {
    const list = photos.v?.photos ?? [];
    if (!list.length) return null;
    const wantPortrait = maxHeight >= 900;
    const matching = list.filter((p) => ((p.aspect ?? 1.5) < 1) === wantPortrait);
    const pool = matching.length ? matching : list;
    const ms = (cfg.v?.photoIntervalMinutes ?? 60) * 60_000;
    return pool[Math.floor(+clock.now / ms) % pool.length];
  });

  // Shown at its true aspect: full width if that fits the room, else height-
  // capped (portraits), centered horizontally.
  const dims = $derived.by(() => {
    if (!photo) return null;
    const a = photo.aspect ?? 1.5;
    const h = Math.min(maxHeight, W / a);
    return { w: Math.round(h * a), h: Math.round(h) };
  });

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
      <div class="ph" style="width: {dims.w}px; height: {dims.h}px"
           in:fade={{ duration: 1500 }} out:fade={{ duration: 1500 }}>
        <img src={photo.url} alt="" />
        {#if caption}
          <div class="credit">{caption}</div>
        {/if}
      </div>
    {/key}
  </div>
{/if}

<style>
  /* Single grid cell so crossfading photos overlap; bottom-anchored like the stack. */
  .frame { flex: 1; display: grid; place-items: end center; }
  .ph { grid-area: 1 / 1; position: relative; }
  img { width: 100%; height: 100%; object-fit: cover; border-radius: 44px; display: block; }
  .credit { position: absolute; left: 36px; bottom: 30px; font-size: 20px; color: rgba(255,255,255,0.85); text-shadow: 0 1px 8px rgba(0,0,0,0.5); }
</style>
