import { test, expect } from 'vitest';
import { eventsFromICS } from '../src/lib/server/calendar.js';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//NO
BEGIN:VEVENT
UID:one@test
DTSTART:20260824T143000Z
DTEND:20260824T153000Z
SUMMARY:Fotball
END:VEVENT
BEGIN:VEVENT
UID:weekly@test
DTSTART:20260803T070000Z
DTEND:20260803T080000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
SUMMARY:Statusmøte
END:VEVENT
BEGIN:VEVENT
UID:cancelled@test
DTSTART:20260810T100000Z
DTEND:20260810T110000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
EXDATE:20260824T100000Z
SUMMARY:Avlyst denne uka
END:VEVENT
END:VCALENDAR`;

// window: Mon 2026-08-24 00:00Z .. Wed 2026-08-26 00:00Z
const win = [new Date('2026-08-24T00:00:00Z'), new Date('2026-08-26T00:00:00Z')];

test('plain event inside window is returned', () => {
  const evs = eventsFromICS(ICS, 'privat', ...win);
  expect(evs.find((e) => e.title === 'Fotball')).toMatchObject({
    label: 'privat', allDay: false,
  });
});

test('weekly recurrence is expanded into the window', () => {
  const evs = eventsFromICS(ICS, 'jobb', ...win);
  const m = evs.find((e) => e.title === 'Statusmøte');
  expect(m).toBeDefined();
  expect(new Date(m.start).toISOString()).toBe('2026-08-24T07:00:00.000Z');
});

test('EXDATE instances are excluded', () => {
  const evs = eventsFromICS(ICS, 'privat', ...win);
  expect(evs.find((e) => e.title === 'Avlyst denne uka')).toBeUndefined();
});

test('events are sorted by start', () => {
  const evs = eventsFromICS(ICS, 'x', ...win);
  const starts = evs.map((e) => +new Date(e.start));
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
});
