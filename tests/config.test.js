import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

test('config.example.json has the shape config.js requires', () => {
	const c = JSON.parse(readFileSync('config.example.json', 'utf8'));
	expect(typeof c.lat).toBe('number');
	expect(typeof c.lon).toBe('number');
	expect(Array.isArray(c.modules)).toBe(true);
	expect(c.modules.flat()).toContain('clock');
	expect(c.people[0].feeds[0]).toHaveProperty('url');
	expect(c.people[0].feeds[0]).toHaveProperty('label');
});
