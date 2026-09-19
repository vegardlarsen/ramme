import config from '$lib/server/config.js';
import { startBrightnessSchedule } from '$lib/server/brightness.js';

if (config.brightness && Object.keys(config.brightness).length) {
	startBrightnessSchedule(config.brightness);
}
