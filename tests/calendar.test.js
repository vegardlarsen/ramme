import { test, expect } from 'vitest';
import { eventsFromICS, parseRemind } from '../src/lib/server/calendar.js';

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
UID:waste@test
DTSTART:20260825T050000Z
DTEND:20260825T053000Z
SUMMARY:Papp/plast
DESCRIPTION:!remind 12 hours\\nSett ut dunken kvelden før
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

test('!remind in the description becomes a reminder window on the event', () => {
  const evs = eventsFromICS(ICS, 'privat', ...win);
  const waste = evs.find((e) => e.title === 'Papp/plast');
  expect(waste.remind.from).toBe('2026-08-24T17:00:00.000Z');  // 12h before 05:00Z start
  expect(waste.remind.until).toBe('2026-08-25T05:30:00.000Z'); // no tail -> event end
  expect(waste.subtitle).toBe('Sett ut dunken kvelden før');
  expect(evs.find((e) => e.title === 'Fotball').remind).toBeUndefined();
});

test('parseRemind grammar', () => {
  expect(parseRemind('!remind 3 hours')).toMatchObject({ leadMs: 3 * 3_600_000, tailMs: 0 });
  expect(parseRemind('!remind 90 min').leadMs).toBe(90 * 60_000);
  expect(parseRemind('!remind 2 days').leadMs).toBe(2 * 86_400_000);
  expect(parseRemind('!remind 3').leadMs).toBe(3 * 3_600_000);   // bare number = hours
  expect(parseRemind('!remind').leadMs).toBe(12 * 3_600_000);    // bare = 12 hours
  expect(parseRemind('!remind 12 hours + 4 hours')).toMatchObject(
    { leadMs: 12 * 3_600_000, tailMs: 4 * 3_600_000 });
  expect(parseRemind('!remind 1 day + 30 min').tailMs).toBe(30 * 60_000);
  expect(parseRemind('!remind + 2 hours')).toMatchObject(       // tail with default lead
    { leadMs: 12 * 3_600_000, tailMs: 2 * 3_600_000 });
  expect(parseRemind('agenda\n!remind 3h\nring vaktmester').subtitle).toBe('agenda\nring vaktmester');
  expect(parseRemind('!remind 1 day\n').subtitle).toBeNull();
  expect(parseRemind('en vennlig påminnelse om møtet')).toBeNull();
});
