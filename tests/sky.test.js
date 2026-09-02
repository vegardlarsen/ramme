import { test, expect } from 'vitest';
import { isDaylight, themeAt, THEMES, mode } from '../src/lib/sky.js';

test('daylight follows sunrise/sunset from the weather data', () => {
  const w = { sunrise: '06:12', sunset: '21:02' };
  expect(isDaylight(6.1, w)).toBe(false);
  expect(isDaylight(6.3, w)).toBe(true);
  expect(isDaylight(21.0, w)).toBe(true);
  expect(isDaylight(21.1, w)).toBe(false);
  expect(isDaylight(2, w)).toBe(false);
});

test('falls back to 07-21 when weather is missing or malformed', () => {
  expect(isDaylight(12, null)).toBe(true);
  expect(isDaylight(6.5, undefined)).toBe(false);
  expect(isDaylight(12, { sunrise: 'n/a', sunset: '' })).toBe(true);
  expect(isDaylight(22, null)).toBe(false);
});

test('themeAt picks light by day, dark by night', () => {
  expect(themeAt(13, null)).toBe(THEMES.light);
  expect(themeAt(23, null)).toBe(THEMES.dark);
});

test('modes', () => {
  expect(mode(7)).toBe('morning');
  expect(mode(13)).toBe('day');
  expect(mode(21)).toBe('evening');
  expect(mode(2)).toBe('evening');
});
