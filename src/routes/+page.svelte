<script>
	let vw = $state(1080), vh = $state(1920);
	const scale = $derived(Math.min(vw / 1080, vh / 1920));
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div class="viewport">
	<div class="stage" style="transform: scale({scale})">
		<!-- filled by Task 8 -->
	</div>
</div>

<style>
	:global(body) { margin: 0; background: #141828; overflow: hidden; cursor: none; }
	.viewport { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
	.stage {
		width: 1080px; height: 1920px; flex: none; position: relative; overflow: hidden;
		font-family: 'Outfit', sans-serif; transform-origin: center;
	}
</style>
