import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchCalendars } from '$lib/server/calendar.js';

const get = cached(5 * 60_000, () => fetchCalendars(config.people));
export const GET = async () => json(await get());
