import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';

export const GET = () => json({ modules: config.modules, reminders: config.reminders });
