import { test, expect } from 'vitest';
import { skyAt, phaseWeights, mode, textColor, skyLuminance } from '../src/lib/sky.js';

test('sky at the 04:30 keyframe matches the design night colors', () => {
  expect(skyAt(4.5, 0)[0].map(Math.round)).toEqual([26, 32, 64]);
});

test('small hours wrap onto the night segment (no discontinuity)', () => {
  // 02:00 lies between the 22.5 and 28.5 keyframes, both night-ish blues
  const [top] = skyAt(2, 0);
  expect(top[0]).toBeGreaterThan(20);
  expect(top[0]).toBeLessThan(40);
});

test('full cloud desaturates toward grey', () => {
  const clear = skyAt(13, 0)[0];
  const cloudy = skyAt(13, 1)[0];
  // cloudy is pulled 45% toward GREY [205,208,212]
  expect(cloudy[0]).toBeCloseTo(clear[0] + (205 - clear[0]) * 0.45, 5);
});

test('phase weights: morning has neither day nor evening', () => {
  expect(phaseWeights(7)).toEqual({ pDag: 0, pKveld: 0 });
});

test('phase weights: midday is full day', () => {
  expect(phaseWeights(13)).toEqual({ pDag: 1, pKveld: 0 });
});

test('phase weights: late evening and small hours are full evening', () => {
  expect(phaseWeights(23).pKveld).toBe(1);
  expect(phaseWeights(2).pKveld).toBe(1);
});

test('modes', () => {
  expect(mode(7)).toBe('morning');
  expect(mode(13)).toBe('day');
  expect(mode(21)).toBe('evening');
  expect(mode(2)).toBe('evening');
});

test('textColor returns a css color', () => {
  expect(textColor(13)).toBe('rgb(23,52,69)');
});

test('text lightness follows sky luminance, not the clock', () => {
  // 20:15 clear: sky is still a bright sunset -> dark text survives
  expect(skyLuminance(skyAt(20.25, 0))).toBeGreaterThan(0.5);
  expect(textColor(20.25, 0)).toBe('rgb(23,52,69)');
  // 21:30 clear: dusk is genuinely dark -> light text
  expect(skyLuminance(skyAt(21.5, 0))).toBeLessThan(0.42);
  expect(textColor(21.5, 0)).toBe('rgb(241,236,250)');
  // overcast midday stays bright (grey, not dark) -> dark text
  expect(textColor(13, 1)).toBe('rgb(23,52,69)');
  // night is dark regardless of cloud
  expect(textColor(2, 0.5)).toBe('rgb(241,236,250)');
});
