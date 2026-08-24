import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchAlbum } from '$lib/server/photos.js';

const get = cached(60 * 60_000, () => fetchAlbum(config.icloudAlbumToken));
export const GET = async () => json(await get());
