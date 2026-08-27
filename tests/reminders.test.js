import { test, expect } from 'vitest';
import { activeReminder, calendarReminders } from '../src/lib/reminders.js';

const gym = { title: 'Gymtøy på skolen', days: [1], from: '05:30', until: '08:00' };
const paper = { title: 'Sett ut papirdunken', days: [1], from: '19:00', until: '23:59' };
const all = [gym, paper];
const monday = (hhmm) => new Date(`2026-08-24T${hhmm}:00`); // a Monday, local time

test('reminder active inside its window on the right day', () => {
  expect(activeReminder(all, monday('07:00'))).toBe(gym);
});

test('nothing active outside all windows', () => {
  expect(activeReminder(all, monday('12:00'))).toBeNull();
});

test('wrong weekday is not active', () => {
  const tuesday = new Date('2026-08-25T07:00:00');
  expect(activeReminder(all, tuesday)).toBeNull();
});

test('overlapping reminders: earliest deadline wins', () => {
  const urgent = { title: 'Nå!', days: [1], from: '06:00', until: '07:30' };
  expect(activeReminder([gym, urgent], monday('07:00'))).toBe(urgent);
});

// Calendar-derived reminders use absolute windows (fromAt/untilAt).
const waste = {
  title: 'Papp/plast', fromAt: '2026-08-24T17:00:00Z',
  untilAt: '2026-08-25T05:30:00Z', startAt: '2026-08-25T05:00:00Z',
};

test('absolute-window reminder active between fromAt and untilAt', () => {
  expect(activeReminder([waste], new Date('2026-08-24T20:00:00Z'))).toBe(waste);
  expect(activeReminder([waste], new Date('2026-08-24T12:00:00Z'))).toBeNull();
  expect(activeReminder([waste], new Date('2026-08-25T06:00:00Z'))).toBeNull();
});

test('mixed shapes: earliest deadline wins across both', () => {
  // Monday 19:30 local: paper (weekly, until 23:59) and waste (until 05:30Z Tue) both active.
  // paper's deadline tonight is earlier than waste's tomorrow morning.
  expect(activeReminder([waste, paper], monday('19:30'))).toBe(paper);
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
