import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchWeather } from '$lib/server/weather.js';

const get = cached(15 * 60_000, () => fetchWeather(config.lat, config.lon));
export const GET = async () => json(await get());
