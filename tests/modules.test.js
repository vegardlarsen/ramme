import { test, expect } from 'vitest';
import { layoutModules, calendarView, REGISTRY } from '../src/lib/modules.js';

const monday = (hhmm) => new Date(`2026-08-24T${hhmm}:00`); // Monday, local
const gym = { title: 'Gymtøy', days: [1], from: '05:30', until: '08:00' };
const weather = { current: { temp: 16 }, hourly: [], tomorrow: { temp: 18, text: 'sol' } };
const calendar = { people: [
  { name: 'Vegard', color: '#C4572E', events: [
    { title: 'Statusmøte', start: '2026-08-24T07:00:00.000Z', end: '2026-08-24T08:00:00.000Z', label: 'jobb', allDay: false },
    { title: 'Bursdag', start: '2026-08-25T10:00:00.000Z', end: '2026-08-25T12:00:00.000Z', label: 'privat', allDay: false },
  ] },
] };
const ORDER = [['clock', 'weather'], 'hourly', 'reminder', 'photos', 'calendar'];
const ctx = (over = {}) => ({
  weather, calendar, photos: ['a.jpg'], reminders: [gym], now: monday('07:00'), ...over,
});

const names = (rows) => rows.map((r) => r.map((m) => m.name));

test('renders enabled+active modules in config order, with row grouping', () => {
  expect(names(layoutModules(ORDER, ctx()))).toEqual(
    [['clock', 'weather'], ['hourly'], ['reminder'], ['photos'], ['calendar']],
  );
});

test('a module not in the order is disabled', () => {
  expect(names(layoutModules(['clock'], ctx()))).toEqual([['clock']]);
});

test('modules with nothing to display are excluded', () => {
  const c = ctx({ reminders: [], photos: [], weather: null });
  // no reminder active, no photos, no weather data -> only clock and calendar remain
  expect(names(layoutModules(ORDER, c))).toEqual([['clock'], ['calendar']]);
});

test('lowest-priority module is dropped when space runs out', () => {
  const rows = layoutModules(ORDER, ctx(), 1200); // squeeze: photos (priority 10) must go
  expect(rows.flat().map((m) => m.name)).not.toContain('photos');
  expect(rows.flat().map((m) => m.name)).toContain('reminder');
});

test('photos render when there is room', () => {
  expect(layoutModules(ORDER, ctx()).flat().map((m) => m.name)).toContain('photos');
});

test('calendarView: one card per person with today\'s remaining events', () => {
  const v = calendarView(ctx());
  expect(v.tomorrow).toBe(false);
  expect(v.items[0].name).toBe('Vegard');
  expect(v.items[0].events.map((e) => e.title)).toEqual(['Statusmøte']); // Bursdag is tomorrow
});

test('calendarView: finished events drop off during the day', () => {
  const v = calendarView(ctx({ now: monday('11:00') })); // Statusmøte ended 10:00 local
  expect(v.items).toEqual([]); // nothing left today -> module hides
});

test('calendarView: from 20:00 the cards show tomorrow', () => {
  const v = calendarView(ctx({ now: monday('21:00') }));
  expect(v.tomorrow).toBe(true);
  expect(v.items[0].events.map((e) => e.title)).toEqual(['Bursdag']);
});

test('calendarView with no relevant events has nothing to display', () => {
  const v = calendarView(ctx({ calendar: { people: [] } }));
  expect(v.items).toEqual([]);
});

test('unknown module names in the order are ignored', () => {
  const rows = layoutModules([['clock', 'wether'], 'nope'], ctx());
  expect(rows.flat().map((m) => m.name)).toEqual(['clock']);
});

test('a side-by-side module that frees no space is not dropped', () => {
  const rows = layoutModules(ORDER, ctx(), 700);
  const names = rows.flat().map((m) => m.name);
  expect(names).toContain('weather'); // kept: removing it saves 0px next to taller clock
  expect(names).not.toContain('reminder');
});
