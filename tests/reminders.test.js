import { test, expect } from 'vitest';
import { activeReminder } from '../src/lib/reminders.js';

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
