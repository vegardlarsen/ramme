import { test, expect } from 'vitest';
import { layoutModules, calendarView, timelineView, nowcastHeadline, REGISTRY } from '../src/lib/modules.js';

const monday = (hhmm) => new Date(`2026-08-24T${hhmm}:00`); // Monday, local
// active Monday ~05:30-08:00 local (Europe/Oslo)
const gym = { title: 'Gymtøy', fromAt: '2026-08-24T03:30:00Z', untilAt: '2026-08-24T06:00:00Z' };
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
  // reminder + timeline calendar together leave no room for photos (priority 10)
  expect(names(layoutModules(ORDER, ctx()))).toEqual(
    [['clock', 'weather'], ['hourly'], ['reminder'], ['calendar']],
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
  const c = ctx({ reminders: [] }); // no reminder card -> photos fit
  expect(layoutModules(ORDER, c).flat().map((m) => m.name)).toContain('photos');
});

test('flex modules learn how much room they actually have', () => {
  const rows = layoutModules(ORDER, ctx({ reminders: [] }));
  const photos = rows.flat().find((m) => m.name === 'photos');
  const cal = rows.flat().find((m) => m.name === 'calendar');
  // slack 1776 - (270 + 185 + 500 + 460 + 3*36) = 253, split between photos and calendar
  expect(photos.maxHeight).toBe(Math.round(500 + 253 / 2));
  expect(cal.maxHeight).toBe(Math.round(460 + 253 / 2));
});

test('calendar stretches when only a reminder competes for space', () => {
  const rows = layoutModules(ORDER, ctx({ photos: [] }));
  const cal = rows.flat().find((m) => m.name === 'calendar');
  // slack 1776 - (270 + 185 + 460 + 460 + 3*36) = 293, split with the reminder
  expect(cal.maxHeight).toBe(Math.round(460 + 293 / 2));
});

test('calendarView: one card per person with today\'s remaining events', () => {
  const v = calendarView(ctx());
  expect(v.tomorrow).toBe(false);
  expect(v.items[0].name).toBe('Vegard');
  expect(v.items[0].events.map((e) => e.title)).toEqual(['Statusmøte']); // Bursdag is tomorrow
});

test('calendarView: the day stays static — finished events remain, marked done', () => {
  const v = calendarView(ctx({ now: monday('11:00') })); // Statusmøte ended 10:00 local
  expect(v.items[0].timed.map((e) => [e.title, e.done, e.now])).toEqual([['Statusmøte', true, false]]);
});

test('calendarView: from 20:00 the cards show tomorrow', () => {
  const v = calendarView(ctx({ now: monday('21:00') }));
  expect(v.tomorrow).toBe(true);
  expect(v.items[0].events.map((e) => e.title)).toEqual(['Bursdag']);
});

test('calendarView: shared hour-rounded timeline with overlap lanes', () => {
  const cal = { people: [
    { name: 'Vegard', color: '#C4572E', events: [
      { title: 'A', start: '2026-08-24T07:00:00.000Z', end: '2026-08-24T09:00:00.000Z', allDay: false },
      { title: 'B', start: '2026-08-24T08:00:00.000Z', end: '2026-08-24T10:00:00.000Z', allDay: false },
    ] },
    { name: 'Louise', events: [
      { title: 'C', start: '2026-08-24T11:00:00.000Z', end: '2026-08-24T11:30:00.000Z', allDay: false },
      { title: 'Hel', start: '2026-08-24T00:00:00.000Z', end: '2026-08-25T00:00:00.000Z', allDay: true },
    ] },
  ] };
  const v = calendarView(ctx({ calendar: cal, now: monday('13:15') }));
  // range 07:00Z–11:30Z rounds to 07:00Z–12:00Z = 5h shared by both columns,
  // regardless of the current time
  const [a, b] = v.items[0].timed;
  expect(a.top).toBe(0);
  expect(a.height).toBeCloseTo(2 / 5);
  expect([a.lanes, b.lanes]).toEqual([2, 2]); // A and B overlap -> side by side
  expect(a.lane).not.toBe(b.lane);
  expect([a.done, b.done]).toEqual([true, true]); // both ended before 13:15
  const [c] = v.items[1].timed;
  expect(c.top).toBeCloseTo(4 / 5);
  expect(c.height).toBeCloseTo(0.5 / 5);
  expect(c.lanes).toBe(1);
  expect([c.done, c.now]).toEqual([false, true]); // 13:00–13:30 is ongoing
  expect(v.items[1].allDay.map((e) => e.title)).toEqual(['Hel']);
  expect(v.hours[0].label).toBe('09'); // 07:00Z = 09:00 Oslo
  expect(v.hours.at(-1).frac).toBe(1);
});

test('calendarView: timeline clamps to 07–23 and keeps a 3h minimum span', () => {
  const cal = { people: [{ name: 'V', events: [
    // 21:00–24:00 local: end clipped at 23, span padded back to 20–23
    { title: 'Sent', start: '2026-08-24T19:00:00.000Z', end: '2026-08-24T22:00:00.000Z', allDay: false },
  ] }] };
  const v = calendarView(ctx({ calendar: cal, now: monday('19:00') }));
  const [e] = v.items[0].timed;
  expect(v.hours[0].label).toBe('20');
  expect(v.hours.at(-1).label).toBe('23');
  expect(e.top).toBeCloseTo(1 / 3);
  expect(e.height).toBeCloseTo(2 / 3); // 23–24 clipped away
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

test('nowcastHeadline: stopping, starting, steady, dry', () => {
  const p = (...mms) => mms.map((mm) => ({ mm }));
  expect(nowcastHeadline(p(1, 1, 0.4, 0, 0, 0))).toBe('opphold om ca. 15 min');
  expect(nowcastHeadline(p(0, 0, 0, 0.8, 1))).toBe('regn om ca. 15 min');
  expect(nowcastHeadline(p(1, 1, 1))).toBe('');
  expect(nowcastHeadline(p(0, 0, 0))).toBe('');
  expect(nowcastHeadline([])).toBe('');
});

test('timelineView: idle stretches over an hour are cut to a break', () => {
  const cal = { people: [{ name: 'Vegard', events: [
    { title: 'A', start: '2026-08-24T08:00:00.000Z', end: '2026-08-24T09:00:00.000Z', allDay: false },
    { title: 'B', start: '2026-08-24T10:00:00.000Z', end: '2026-08-24T10:30:00.000Z', allDay: false }, // 1h gap: kept
    { title: 'C', start: '2026-08-24T20:00:00.000Z', end: '2026-08-24T20:00:00.000Z', allDay: false }, // zero-length, far away
  ] }] };
  const v = timelineView(ctx({ calendar: cal, now: monday('09:00') }));
  // segments 10–13 and 22–23 local (4h) + one half-hour break
  expect(v.ticks.map((t) => t.label)).toEqual(['10', '11', '12', '13', '22', '23']);
  expect(v.breaks).toHaveLength(1);
  const [a, b, c] = v.items[0].timed;
  expect(a.left).toBe(0);
  expect(a.width).toBeCloseTo(1 / 4.5);
  expect(b.left).toBeCloseTo(2 / 4.5);
  expect(c.left).toBeCloseTo(3.5 / 4.5);
  expect(a.room).toBeCloseTo(b.left); // label runs up to B
  expect(c.room).toBeCloseTo(1 / 4.5);
});
