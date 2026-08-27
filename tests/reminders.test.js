import { test, expect } from 'vitest';
import { activeReminder, calendarReminders } from '../src/lib/reminders.js';

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
