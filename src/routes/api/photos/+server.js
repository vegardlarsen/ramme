import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchAlbum } from '$lib/server/photos.js';

// iCloud asset URLs expire 20 min after issue (url_expiry); 10 min here plus
// the client's 5 min poll keeps every URL the screen sees under 15 min old.
const get = cached(10 * 60_000, () => fetchAlbum(config.icloudAlbumToken));
export const GET = async () => json(await get());
