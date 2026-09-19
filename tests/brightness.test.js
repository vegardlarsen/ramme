import { test, expect } from 'vitest';
import { levelAt } from '../src/lib/server/brightness.js';

const at = (hhmm) => new Date(`2026-08-24T${hhmm}:00`);
const schedule = { '07:00': 100, '21:00': 30 };

test('level from the most recent entry at or before now', () => {
	expect(levelAt(schedule, at('07:00'))).toBe(100);
	expect(levelAt(schedule, at('12:34'))).toBe(100);
	expect(levelAt(schedule, at('21:00'))).toBe(30);
	expect(levelAt(schedule, at('23:59'))).toBe(30);
});

test('before the first entry wraps to the last entry of the day', () => {
	expect(levelAt(schedule, at('03:00'))).toBe(30);
});

test('empty schedule yields null', () => {
	expect(levelAt({}, at('12:00'))).toBe(null);
});
