import { test, expect } from 'vitest';
import { activeReminder, calendarReminders, transitReminders, allReminders } from '../src/lib/reminders.js';

const waste = {
  title: 'Papp/plast', fromAt: '2026-08-24T17:00:00Z',
  untilAt: '2026-08-25T05:30:00Z', startAt: '2026-08-25T05:00:00Z',
};

test('reminder active between fromAt and untilAt', () => {
  expect(activeReminder([waste], new Date('2026-08-24T20:00:00Z'))).toBe(waste);
  expect(activeReminder([waste], new Date('2026-08-24T12:00:00Z'))).toBeNull();
  expect(activeReminder([waste], new Date('2026-08-25T06:00:00Z'))).toBeNull();
});

test('overlapping reminders: earliest deadline wins', () => {
  const urgent = { title: 'Nå!', fromAt: '2026-08-24T18:00:00Z', untilAt: '2026-08-24T22:00:00Z' };
  expect(activeReminder([waste, urgent], new Date('2026-08-24T20:00:00Z'))).toBe(urgent);
});

test('empty list -> null', () => {
  expect(activeReminder([], new Date())).toBeNull();
});

test('transitReminders: situations and cancelled calls become Avvik cards, quiet groups none', () => {
  const now = new Date('2026-09-20T18:00:00Z');
  const deps = [
    { label: 'Båt til Bergen',
      situations: ['Innstilt grunna teknisk feil'],
      calls: [{ aimed: '2026-09-21T06:00:00+02:00', expected: '2026-09-21T06:00:00+02:00',
                cancelled: true, realtime: true }] },
    { label: 'Stille', situations: [], calls: [
      { aimed: '2026-09-21T07:00:00+02:00', cancelled: false }] },
  ];
  const rs = transitReminders(deps, now);
  expect(rs).toHaveLength(1);
  expect(rs[0].label).toBe('Avvik');
  expect(rs[0].title).toBe('Båt til Bergen');
  expect(rs[0].subtitle).toMatch(/Innstilt grunna teknisk feil · Avgang \d\d[.:]\d\d innstilt/);
  expect(transitReminders(null, now)).toEqual([]);
});

test('transit deviation outranks an active calendar reminder', () => {
  const now = new Date('2026-08-24T20:00:00Z');
  const deps = [{ label: 'Båt', situations: ['Avvik'], calls: [] }];
  const winner = activeReminder(allReminders({ people: [] }, deps, now), now);
  expect(winner.label).toBe('Avvik');
  const both = activeReminder([waste, ...transitReminders(deps, now)], now);
  expect(both.label).toBe('Avvik');
});

test('calendarReminders extracts events carrying remind', () => {
  const cal = { people: [{ name: 'V', events: [
    { title: 'Papp/plast', start: '2026-08-25T05:00:00.000Z', end: '2026-08-25T05:30:00.000Z',
      subtitle: 'Sett ut dunken',
      remind: { from: '2026-08-24T17:00:00.000Z', until: '2026-08-25T09:30:00.000Z' } },
    { title: 'Fotball', start: 'x', end: 'y' },
  ] }] };
  expect(calendarReminders(cal)).toEqual([{
    title: 'Papp/plast', subtitle: 'Sett ut dunken',
    fromAt: '2026-08-24T17:00:00.000Z', untilAt: '2026-08-25T09:30:00.000Z',
    startAt: '2026-08-25T05:00:00.000Z',
  }]);
  expect(calendarReminders(null)).toEqual([]);
});
