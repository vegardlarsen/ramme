import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchNowcast } from '$lib/server/weather.js';

const get = cached(5 * 60_000, () => fetchNowcast(config.lat, config.lon));
export const GET = async () => json(await get());
