import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';

export const GET = () => json({
  modules: config.modules,
  photoIntervalMinutes: config.photoIntervalMinutes,
});
