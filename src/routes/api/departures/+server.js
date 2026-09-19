import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchDepartures } from '$lib/server/departures.js';

const get = cached(60_000, () => fetchDepartures(config.departures ?? []));
export const GET = async () => json(await get());
