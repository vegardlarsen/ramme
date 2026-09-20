import { test, expect } from 'vitest';
import { normalizeDepartures, buildQuery } from '../src/lib/server/departures.js';

const call = (expected, over = {}) => ({
  realtime: true,
  aimedDepartureTime: expected,
  expectedDepartureTime: expected,
  cancellation: false,
  destinationDisplay: { frontText: 'Strandkaiterminalen' },
  situations: [],
  serviceJourney: { line: { situations: [] } },
  ...over,
});

const NOW = +new Date('2026-09-19T12:00:00+02:00');

test('destination filter, count and withinHours', () => {
  const groups = [
    { label: 'Buss', stop: 'NSR:StopPlace:1', lines: ['SKY:Line:310'], withinHours: 2 },
    { label: 'Båt', stop: 'NSR:StopPlace:2', lines: ['SKY:Line:390'],
      destination: 'Strandkaiterminalen', count: 2 },
  ];
  const data = {
    g0: { estimatedCalls: [
      call('2026-09-19T12:30:00+02:00'),
      call('2026-09-19T16:00:00+02:00'), // beyond withinHours
    ] },
    g1: { estimatedCalls: [
      call('2026-09-19T13:00:00+02:00', { destinationDisplay: { frontText: 'Knarvik kai' } }),
      call('2026-09-21T06:00:00+02:00'),
      call('2026-09-21T07:08:00+02:00'),
      call('2026-09-21T08:16:00+02:00'), // beyond count
    ] },
  };
  const [bus, boat] = normalizeDepartures(data, groups, NOW);
  expect(bus.calls.map((c) => c.expected)).toEqual(['2026-09-19T12:30:00+02:00']);
  expect(boat.calls.map((c) => c.expected)).toEqual(
    ['2026-09-21T06:00:00+02:00', '2026-09-21T07:08:00+02:00']);
});

test('situations: norwegian preferred, deduped across calls and line', () => {
  const sit = (no, en) => ({ summary: [
    { value: en, language: 'en' }, { value: no, language: 'no' },
  ] });
  const data = { g0: { estimatedCalls: [
    call('2026-09-19T12:30:00+02:00', {
      cancellation: true,
      situations: [sit('Innstilt grunna teknisk feil', 'Cancelled')],
      serviceJourney: { line: { situations: [sit('Innstilt grunna teknisk feil', 'Cancelled')] } },
    }),
    call('2026-09-19T13:30:00+02:00'),
  ] } };
  const [g] = normalizeDepartures(data, [{ label: 'Båt', stop: 's', lines: [] }], NOW);
  expect(g.situations).toEqual(['Innstilt grunna teknisk feil']);
  expect(g.calls[0].cancelled).toBe(true);
});

test('missing stop in response yields an empty group, and query names each alias', () => {
  const groups = [{ label: 'X', stop: 'NSR:StopPlace:9', lines: ['SKY:Line:1'] }];
  expect(normalizeDepartures({}, groups, NOW)).toEqual([
    { label: 'X', situations: [], calls: [] },
  ]);
  expect(buildQuery(groups)).toContain('g0: stopPlace(id: "NSR:StopPlace:9")');
  expect(buildQuery(groups)).toContain('whiteListed: {lines: ["SKY:Line:1"]}');
});
