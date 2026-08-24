<script>
  import { fade } from 'svelte/transition';
  import { clock, photos, cfg } from '$lib/data.svelte.js';

  const url = $derived.by(() => {
    const urls = photos.v?.photos ?? [];
    if (!urls.length) return null;
    const ms = (cfg.v?.photoIntervalMinutes ?? 60) * 60_000;
    return urls[Math.floor(+clock.now / ms) % urls.length];
  });
</script>

{#if url}
  <div class="frame">
    {#key url}
      <img src={url} alt="" in:fade={{ duration: 1500 }} out:fade={{ duration: 1500 }} />
    {/key}
    <div class="credit">Fra bildearkivet</div>
  </div>
{/if}

<style>
  .frame { flex: 1; position: relative; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 44px; }
  .credit { position: absolute; left: 36px; bottom: 30px; font-size: 20px; color: rgba(255,255,255,0.85); text-shadow: 0 1px 8px rgba(0,0,0,0.5); }
</style>
