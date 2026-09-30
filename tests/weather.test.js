import { test, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { normalizeWeather, normalizeNowcast, fetchNowcast, windOf } from '../src/lib/server/weather.js';

const entry = (time, temp, cloud, symbol, precip = 0) => ({
  time,
  data: {
    instant: { details: { air_temperature: temp, cloud_area_fraction: cloud,
                          wind_speed: 3.6, wind_from_direction: 92.4 } },
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
  expect(w.hourly[0].wind).toEqual({ speed: 4, from: 92, gust: null });
  expect(w.current.wind).toEqual({ speed: 4, from: 92, gust: null });
  expect(w.tomorrow.wind).toEqual({ speed: 4, from: 92, gust: null });
});

test('tomorrow shows the day\'s high, not the noon temperature', () => {
  const ts = forecast.properties.timeseries.map((t) =>
    t.time === '2026-08-25T14:00:00.000Z' ? entry(t.time, 23.4, 10, 'clearsky_day') : t);
  expect(normalizeWeather({ properties: { timeseries: ts } }, sun).tomorrow.temp).toBe(23);
});

test('rain boosts cloud for sky desaturation', () => {
  const rainy = { properties: { timeseries: [
    entry('2026-08-24T12:00:00Z', 12, 40, 'rain', 2.1),
    ...forecast.properties.timeseries.slice(1),
  ] } };
  expect(normalizeWeather(rainy, sun).current.cloud).toBeGreaterThanOrEqual(0.8);
});

test('normalizeNowcast maps precipitation rate, missing -> 0', () => {
  const nc = { properties: { timeseries: [
    { time: '2026-08-24T12:00:00Z', data: { instant: { details: { precipitation_rate: 1.4 } } } },
    { time: '2026-08-24T12:05:00Z', data: { instant: { details: {} } } },
  ] } };
  expect(normalizeNowcast(nc)).toEqual([
    { time: '2026-08-24T12:00:00Z', mm: 1.4 },
    { time: '2026-08-24T12:05:00Z', mm: 0 },
  ]);
});

test('fetchNowcast: 422 means no data, transient errors throw (cache serves stale)', async () => {
  const orig = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 422 });
    expect(await fetchNowcast(60, 5)).toEqual([]);
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await expect(fetchNowcast(60, 5)).rejects.toThrow('503');
  } finally { globalThis.fetch = orig; }
});

test('windOf shows gusts only when more than 20% above the mean wind', () => {
  const at = (speed, gust) => windOf({ data: { instant: { details:
    { wind_speed: speed, wind_speed_of_gust: gust, wind_from_direction: 180 } } } });
  expect(at(4.2, 6.4).gust).toBe(6);
  expect(at(5, 6).gust).toBe(null);    // exactly 20%: not shown
  expect(at(3.6, 4.4).gust).toBe(null); // >20%, but both round to 4 m/s
  expect(at(4, undefined).gust).toBe(null); // beyond MET's gust horizon
});

test('windOf hides negligible wind (below 3.4 m/s, Beaufort "svak vind")', () => {
  const at = (speed) => windOf({ data: { instant: { details: { wind_speed: speed, wind_from_direction: 90 } } } });
  expect(at(3.3)).toBe(null);
  expect(at(undefined)).toBe(null);
  expect(at(3.4)).toEqual({ speed: 3, from: 90, gust: null });
});
