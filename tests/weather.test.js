import { test, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { normalizeWeather } from '../src/lib/server/weather.js';

const entry = (time, temp, cloud, symbol, precip = 0) => ({
  time,
  data: {
    instant: { details: { air_temperature: temp, cloud_area_fraction: cloud } },
    next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: precip } },
  },
});

const forecast = { properties: { timeseries: [
  entry('2026-08-24T12:00:00Z', 16.3, 35, 'partlycloudy_day'),
  ...Array.from({ length: 40 }, (_, i) =>
    entry(new Date(Date.UTC(2026, 7, 24, 13 + i)).toISOString(), 17, 10, 'clearsky_day')),
] } };

const sun = { properties: {
  sunrise: { time: '2026-08-24T04:12:00Z' },
  sunset:  { time: '2026-08-24T19:02:00Z' },
} };

test('symbol codes pass through raw and have a matching vendored MET icon', () => {
  const w = normalizeWeather(forecast, sun);
  const icons = new Set(readdirSync('static/weather'));
  for (const s of [w.current.symbol, w.tomorrow.symbol, ...w.hourly.map((h) => h.symbol)]) {
    expect(icons.has(`${s}.svg`)).toBe(true);
  }
});

test('normalizeWeather produces the screen model', () => {
  const w = normalizeWeather(forecast, sun);
  expect(w.current.temp).toBe(16);
  expect(w.current.symbol).toBe('partlycloudy_day');
  expect(w.current.cloud).toBeCloseTo(0.35);
  expect(w.hourly).toHaveLength(6);
  expect(w.hourly[0].temp).toBe(17);
  expect(w.sunrise).toMatch(/^\d\d:\d\d$/);
  expect(w.tomorrow.temp).toBe(17);
});

test('rain boosts cloud for sky desaturation', () => {
  const rainy = { properties: { timeseries: [
    entry('2026-08-24T12:00:00Z', 12, 40, 'rain', 2.1),
    ...forecast.properties.timeseries.slice(1),
  ] } };
  expect(normalizeWeather(rainy, sun).current.cloud).toBeGreaterThanOrEqual(0.8);
});
