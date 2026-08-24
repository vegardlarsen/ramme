export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const rgb = (c) => `rgb(${c.map(Math.round).join(',')})`;
export const rgba4 = (c) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;

// Sky keyframes from the design (docs/design/ambient-scene.jsx): [hour, top, mid, bottom]
// ponytail: sunrise/sunset anchors are static (06:12 / 21:02); shift them from the
// Sunrise API if winter screens look wrong.
const SKY = [
  [4.5,  [26, 32, 64],   [16, 20, 36],   [30, 20, 42]],
  [6.2,  [120, 110, 160],[255, 200, 160],[210, 195, 210]],
  [7.25, [255, 217, 188],[255, 243, 228],[207, 228, 242]],
  [11.0, [221, 240, 251],[253, 254, 255],[244, 250, 254]],
  [16.0, [200, 228, 246],[250, 250, 248],[255, 240, 222]],
  [19.6, [150, 160, 200],[255, 190, 150],[240, 172, 140]],
  [21.2, [70, 84, 130],  [58, 58, 98],   [88, 58, 88]],
  [22.5, [38, 48, 79],   [20, 24, 40],   [36, 22, 41]],
  [28.5, [26, 32, 64],   [16, 20, 36],   [30, 20, 42]],
];
const GREY = [205, 208, 212];

export function skyAt(h, cloud) {
  const x = h < SKY[0][0] ? h + 24 : h;
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (x >= SKY[i][0] && x <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  }
  const t = (x - a[0]) / (b[0] - a[0]);
  return [1, 2, 3].map((i) => mix(mix(a[i], b[i], t), GREY, cloud * 0.45));
}

export const TXT = { m: [58, 42, 32], d: [23, 52, 69], k: [241, 236, 250] };
export const PAN = { m: [255, 255, 255, 0.5], d: [23, 52, 69, 0.06], k: [255, 255, 255, 0.08] };

const smooth = (x, a, b) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Layered like the mockup: evening overrides day overrides morning, so the
// small hours (pDag=0, pKveld=1) resolve to evening colors with no special case.
export function phaseWeights(h) {
  const pDag = smooth(h, 8.3, 9.5);
  const pKveld = h >= 12 ? smooth(h, 19.5, 21.2) : 1 - smooth(h, 4.5, 6.5);
  return { pDag, pKveld };
}

export function mode(h) {
  return h < 4.5 || h >= 19.5 ? 'evening' : h < 9 ? 'morning' : 'day';
}

export function textColor(h) {
  const { pDag, pKveld } = phaseWeights(h);
  return rgb(mix(mix(TXT.m, TXT.d, pDag), TXT.k, pKveld));
}

export function panelColor(h) {
  const { pDag, pKveld } = phaseWeights(h);
  return rgba4(mix(mix(PAN.m, PAN.d, pDag), PAN.k, pKveld));
}
