import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('config.json', 'utf8'));
for (const k of ['lat', 'lon', 'modules', 'people', 'reminders']) {
	if (config[k] === undefined) throw new Error(`config.json missing "${k}"`);
}
export default config;
