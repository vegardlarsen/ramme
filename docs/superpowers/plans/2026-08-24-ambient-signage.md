# Ambient Home Signage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen 1080×1920 portrait home dashboard for a Raspberry Pi, built as an ordered stack of toggleable modules, that adapts its content and animated sky background to the time of day and the weather: weather (yr.no), family calendars (iCal), reminders (static), photos (iCloud shared album).

**Architecture:** One SvelteKit app with `adapter-node`. The Node server side exists only to proxy and cache the external data sources (browsers can't set the User-Agent api.met.no requires, and iCal/iCloud feeds don't send CORS headers). The client is a single SSR-disabled page: a fixed 1080×1920 "stage" scaled to the viewport. The screen is **module-driven**: `config.json` lists modules in screen order; a module registry gives each one an `active(ctx)` test ("do I have anything to show?"), a `minHeight`, and a `priority`; a pure layout function renders enabled+active modules in order and drops the lowest-priority ones when they don't fit — which is how photos only appear when there is room. Visual design (sky model, colors, typography, per-module layouts) is ported verbatim from `docs/design/ambient-scene.jsx`, with the mockup's timeline weights re-derived from the real clock. Chromium in kiosk mode on the Pi points at `http://localhost:3000`.

**Tech Stack:** Svelte 5 (runes) + SvelteKit + `@sveltejs/adapter-node`, plain JS, Vitest, `node-ical` (the only runtime dependency), Node 22, Chromium kiosk on Raspberry Pi OS Bookworm.

**Spec:** `docs/design/ambient-scene.jsx` (the design mockup — layout, typography, color tables, and the sky model come from it) plus the feature list below.

## Feature spec (from the user request)

1. **Module-driven screen.** The set of enabled modules and their top-to-bottom order come from config (`modules` array — listing "clock" first puts it at the top). Available modules: `clock`, `weather` (current conditions), `hourly` (forecast strip), `reminder`, `photos`, `calendar`.
2. **Modules can decline to render.** Each module can say "I have nothing to display right now" (no active reminder, no events today, no photos) and is excluded from the stack.
3. **Priority + room.** Modules have priorities; when the active modules don't fit in the 1920px stage, the lowest-priority ones are dropped. Photos have the lowest priority, so images only show when there is room.
4. Screen adapts to time of day: morning / day / evening modes change module content and the color scheme.
5. Weather from yr.no (api.met.no Locationforecast 2.0 + Sunrise 3.0): current conditions, 6-slot hourly strip, sunrise/sunset, tomorrow preview.
6. One or more iCalendar feeds per person; feeds carry a label (e.g. "jobb"/"privat") shown on the event.
7. Reminders are a static configured set (source TBD later) with active time windows.
8. Photos from an iCloud shared album (JSON webstream feed).
9. Animated sky background computed continuously from clock time, desaturated by cloud cover/rain (rainy = grey).

## Global Constraints

- Screen is fixed **1080×1920 portrait**; all design px values are used verbatim inside a scaled stage. Content area = 1920 − 2×72 padding = **1776px**; inter-module gap **36px**.
- UI copy is **Norwegian (nb-NO)**, matching the design ("lettskyet", "I kveld", …).
- Font is **Outfit** via Google Fonts (weights 300–700), fallback `sans-serif`.
- api.met.no calls MUST send a `User-Agent` identifying the app: `mat-signage/1.0 vegard@beat.no`. Never call external APIs from the browser — everything goes through `/api/*` server routes.
- Server endpoints cache and **return last-good data on upstream failure** (the screen must never go blank because wifi blipped).
- Only runtime npm dependency allowed: `node-ical`. Everything else is stdlib/platform.
- `config.json` (repo root) holds secrets-ish values (feed URLs, album token) and is **gitignored**; `config.example.json` is committed.
- Module layout decisions (enabled, order, active, dropped-for-space) are made by **pure functions in `src/lib/modules.js`** — no DOM measurement — so they are unit-testable.
- Node 22, npm. Tests run with `npm test` (`vitest run`).
- Time-of-day is overridable with query param `?t=HH:MM` for testing/previewing any phase.

## File structure

```
config.example.json           # committed template; copy to config.json (gitignored)
src/lib/server/config.js      # loads + validates config.json
src/lib/server/cache.js       # cached(ttl, fn) — TTL cache that serves stale on error
src/lib/server/weather.js     # normalize MET forecast+sunrise JSON -> screen model
src/lib/server/calendar.js    # fetch+parse iCal feeds -> per-person events (node-ical)
src/lib/server/photos.js      # iCloud shared-album webstream -> image URL list
src/lib/sky.js                # SKY table, skyAt(h, cloud), phase weights, mode  (pure, shared)
src/lib/reminders.js          # activeReminder(reminders, date)                 (pure, shared)
src/lib/modules.js            # REGISTRY, calendarView(ctx), layoutModules()    (pure, shared)
src/lib/data.svelte.js        # client: clock + polling stores ($state)
src/routes/api/weather/+server.js
src/routes/api/calendar/+server.js
src/routes/api/photos/+server.js
src/routes/api/config/+server.js   # client-safe config subset: modules, reminders
src/routes/+page.js           # ssr = false
src/routes/+page.svelte       # stage scaling + sky background + module stack renderer
src/lib/ui/Icon.svelte        # weather icon paths (sun/cloudsun/cloud/moon/rain/snow)
src/lib/ui/Clock.svelte       # module: big clock + date line
src/lib/ui/CurrentWeather.svelte  # module: current-conditions panel
src/lib/ui/HourlyStrip.svelte # module: 6-slot forecast strip
src/lib/ui/Reminder.svelte    # module: active reminder card
src/lib/ui/Photos.svelte      # module: photo slideshow (flex, lowest priority)
src/lib/ui/Calendar.svelte    # module: per-mode calendar row
tests/*.test.js
deploy/mat-signage.service    # systemd unit
deploy/kiosk-autostart        # labwc autostart snippet
README.md                     # dev + full Pi setup instructions
```

Pure logic (sky, reminders, module layout, normalizers) lives outside components so it is unit-testable; components stay thin and render exactly one module each.

---

### Task 1: Scaffold, config, stage shell

**Files:**
- Create: SvelteKit scaffold (via `sv create`), `svelte.config.js` (modify), `config.example.json`, `config.json`, `.gitignore` (modify), `src/lib/server/config.js`, `src/routes/+page.js`, `src/routes/+page.svelte`, `src/app.html` (modify: font link)
- Test: `tests/config.test.js`

**Interfaces:**
- Produces: `config` (default export of `src/lib/server/config.js`) with shape `{lat, lon, modules, people: [{name, color, feeds: [{url, label}]}], icloudAlbumToken, reminders: [...]}` — used by all `/api/*` routes.
- Produces: `modules` config entries are either a module name string or an array of names (an array renders side by side in one row, e.g. clock + current weather as in the design).
- Produces: `+page.svelte` stage div that Task 8 fills.

- [ ] **Step 1: Scaffold the app**

```bash
cd /Users/vegardlarsen/git/vegard/mat
git init
npx sv create .   # pick: minimal template, no type checking (plain JS), npm, no add-ons
npm i -D @sveltejs/adapter-node vitest
npm i node-ical
```

Swap the adapter in `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = { kit: { adapter: adapter() } };
export default config;
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write config files**

`config.example.json`:

```json
{
  "lat": 59.91,
  "lon": 10.75,
  "modules": [["clock", "weather"], "hourly", "reminder", "photos", "calendar"],
  "people": [
    { "name": "Vegard", "color": "#C4572E", "feeds": [
      { "url": "https://example.com/work.ics", "label": "jobb" },
      { "url": "https://example.com/home.ics", "label": "privat" }
    ]},
    { "name": "Anne C.", "color": "#3A6EA5", "feeds": [
      { "url": "https://example.com/annec.ics", "label": "privat" }
    ]}
  ],
  "icloudAlbumToken": "",
  "reminders": [
    { "title": "Gymtøy på skolen", "subtitle": "Louise · kroppsøving 3. time",
      "label": "Før 08:00", "days": [1], "from": "05:30", "until": "08:00" },
    { "title": "Sett ut papirdunken", "subtitle": "Papiravfall hentes i morgen tidlig",
      "label": "I kveld", "days": [4], "from": "19:00", "until": "23:59" }
  ]
}
```

`modules` is top-to-bottom screen order; remove an entry to disable that module; a nested array is one side-by-side row. `days` uses JS `Date.getDay()` numbering (0 = søndag). Copy the file to `config.json` and add `config.json` to `.gitignore`.

`src/lib/server/config.js`:

```js
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('config.json', 'utf8'));
for (const k of ['lat', 'lon', 'modules', 'people', 'reminders']) {
  if (config[k] === undefined) throw new Error(`config.json missing "${k}"`);
}
export default config;
```

- [ ] **Step 3: Write the failing config test**

`tests/config.test.js`:

```js
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

test('config.example.json has the shape config.js requires', () => {
  const c = JSON.parse(readFileSync('config.example.json', 'utf8'));
  expect(typeof c.lat).toBe('number');
  expect(typeof c.lon).toBe('number');
  expect(Array.isArray(c.modules)).toBe(true);
  expect(c.modules.flat()).toContain('clock');
  expect(c.people[0].feeds[0]).toHaveProperty('url');
  expect(c.people[0].feeds[0]).toHaveProperty('label');
  expect(c.reminders[0]).toHaveProperty('from');
  expect(c.reminders[0]).toHaveProperty('until');
  expect(c.reminders[0]).toHaveProperty('days');
});
```

Run `npm test` — must pass (it validates the files you just wrote; if it fails, the shapes drifted).

- [ ] **Step 4: Stage shell**

`src/routes/+page.js`:

```js
export const ssr = false; // kiosk app; no SSR, everything renders from polled data
```

`src/app.html`: add inside `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

`src/routes/+page.svelte`:

```svelte
<script>
  let vw = $state(1080), vh = $state(1920);
  const scale = $derived(Math.min(vw / 1080, vh / 1920));
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div class="viewport">
  <div class="stage" style="transform: scale({scale})">
    <!-- filled by Task 8 -->
  </div>
</div>

<style>
  :global(body) { margin: 0; background: #141828; overflow: hidden; cursor: none; }
  .viewport { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
  .stage {
    width: 1080px; height: 1920px; flex: none; position: relative; overflow: hidden;
    font-family: 'Outfit', sans-serif; transform-origin: center;
  }
</style>
```

- [ ] **Step 5: Verify dev server renders**

Run `npm run dev`, open the printed URL: dark empty stage, no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit signage app with module config and scaled 1080x1920 stage"
```

---

### Task 2: Sky and phase model (pure logic)

**Files:**
- Create: `src/lib/sky.js`
- Test: `tests/sky.test.js`

**Interfaces:**
- Produces:
  - `mix(a, b, t)` → number[], `rgb(c)` → `"rgb(r,g,b)"`, `rgba4(c)` → `"rgba(r,g,b,a)"`
  - `skyAt(h, cloud)` → `[top, mid, bottom]` RGB triples (h = decimal hour 0–24, cloud 0–1)
  - `phaseWeights(h)` → `{pDag, pKveld}` (0–1 each, layered exactly like the mockup)
  - `mode(h)` → `'morning' | 'day' | 'evening'`
  - `textColor(h)` → `"rgb(...)"`, `panelColor(h)` → `"rgba(...)"`
  - `TXT`, `PAN` color tables

- [ ] **Step 1: Write the failing tests**

`tests/sky.test.js`:

```js
import { test, expect } from 'vitest';
import { skyAt, phaseWeights, mode, textColor } from '../src/lib/sky.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/sky.js`**

The SKY table, `GREY`, `skyAt`, `TXT_*`/`PAN_*`, and the layered mixing are copied verbatim from `docs/design/ambient-scene.jsx`; only the phase weights change source: the mockup drives `pDag`/`pKveld` from a timeline, we derive them from the decimal hour with smoothstep ramps.

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: all sky tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sky.js tests/sky.test.js
git commit -m "feat: sky gradient and day-phase model ported from design"
```

---

### Task 3: Weather endpoint (api.met.no)

**Files:**
- Create: `src/lib/server/cache.js`, `src/lib/server/weather.js`, `src/routes/api/weather/+server.js`
- Test: `tests/weather.test.js`, `tests/cache.test.js`

**Interfaces:**
- Consumes: `config` (Task 1) for `lat`/`lon`.
- Produces: `cached(ttlMs, fn)` from `cache.js` — returns an async function; result is memoized for `ttlMs` and **the last good value is returned if `fn` throws** (used by all API routes).
- Produces: `GET /api/weather` → JSON:

```js
{
  current: { temp: 16, icon: 'cloudsun', text: 'lettskyet', precip: 0, cloud: 0.35 },
  hourly:  [ { hour: '14', temp: 17, icon: 'sun' }, /* 6 entries, +2h apart */ ],
  sunrise: '06:12', sunset: '21:02',
  tomorrow: { temp: 18, icon: 'sun', text: 'sol' },
  updatedAt: '2026-08-24T13:00:00Z'
}
```

  `icon` ∈ `sun | cloudsun | cloud | moon | rain | snow`. `cloud` is 0–1 and already boosted to ≥0.8 when precipitation is expected (drives sky desaturation).

- [ ] **Step 1: Write the failing tests**

`tests/cache.test.js`:

```js
import { test, expect } from 'vitest';
import { cached } from '../src/lib/server/cache.js';

test('caches within ttl and serves stale on error', async () => {
  let n = 0;
  const get = cached(10_000, async () => {
    n++;
    if (n === 2) throw new Error('upstream down');
    return n;
  });
  expect(await get()).toBe(1);
  expect(await get()).toBe(1);       // cached, fn not called again
  get.expire();                      // test hook: force refetch
  expect(await get()).toBe(1);       // fn threw -> stale value served
  get.expire();
  expect(await get()).toBe(3);       // recovered
});
```

`tests/weather.test.js` — use a trimmed real-shaped MET fixture inline:

```js
import { test, expect } from 'vitest';
import { normalizeWeather, iconFor } from '../src/lib/server/weather.js';

const entry = (time, temp, cloud, symbol, precip = 0) => ({
  time,
  data: {
    instant: { details: { air_temperature: temp, cloud_area_fraction: cloud } },
    next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: precip } },
  },
});

const forecast = { properties: { timeseries: [
  entry('2026-08-24T12:00:00Z', 16.3, 35, 'partlycloudy_day'),
  ...Array.from({ length: 40 }, (_, i) =>
    entry(new Date(Date.UTC(2026, 7, 24, 13 + i)).toISOString(), 17, 10, 'clearsky_day')),
] } };

const sun = { properties: {
  sunrise: { time: '2026-08-24T04:12:00Z' },
  sunset:  { time: '2026-08-24T19:02:00Z' },
} };

test('iconFor maps MET symbol codes to design icons', () => {
  expect(iconFor('clearsky_day')).toBe('sun');
  expect(iconFor('clearsky_night')).toBe('moon');
  expect(iconFor('partlycloudy_day')).toBe('cloudsun');
  expect(iconFor('cloudy')).toBe('cloud');
  expect(iconFor('lightrainshowers_day')).toBe('rain');
  expect(iconFor('heavysnow')).toBe('snow');
});

test('normalizeWeather produces the screen model', () => {
  const w = normalizeWeather(forecast, sun);
  expect(w.current.temp).toBe(16);
  expect(w.current.icon).toBe('cloudsun');
  expect(w.current.cloud).toBeCloseTo(0.35);
  expect(w.hourly).toHaveLength(6);
  expect(w.hourly[0].temp).toBe(17);
  expect(w.sunrise).toMatch(/^\d\d:\d\d$/);
  expect(w.tomorrow.temp).toBe(17);
});

test('rain boosts cloud for sky desaturation', () => {
  const rainy = { properties: { timeseries: [
    entry('2026-08-24T12:00:00Z', 12, 40, 'rain', 2.1),
    ...forecast.properties.timeseries.slice(1),
  ] } };
  expect(normalizeWeather(rainy, sun).current.cloud).toBeGreaterThanOrEqual(0.8);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/server/cache.js`:

```js
// TTL cache that never lets an upstream failure take the screen down:
// serves the last good value when the refresh throws.
export function cached(ttlMs, fn) {
  let value, at = 0, inflight;
  const get = async () => {
    if (value !== undefined && Date.now() - at < ttlMs) return value;
    inflight ??= fn()
      .then((v) => { value = v; at = Date.now(); return v; })
      .catch((e) => {
        if (value !== undefined) { at = Date.now(); return value; } // stale
        throw e;
      })
      .finally(() => { inflight = undefined; });
    return inflight;
  };
  get.expire = () => { at = 0; };
  return get;
}
```

`src/lib/server/weather.js`:

```js
const UA = 'mat-signage/1.0 vegard@beat.no';

export function iconFor(symbol) {
  const night = symbol.endsWith('_night');
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('snow') || s.includes('sleet')) return 'snow';
  if (s.includes('rain')) return 'rain';
  if (s === 'clearsky' || s === 'fair') return night ? 'moon' : 'sun';
  if (s === 'partlycloudy') return night ? 'moon' : 'cloudsun';
  return 'cloud';
}

const TEXT_NO = {
  clearsky: 'klart', fair: 'lettskyet', partlycloudy: 'delvis skyet', cloudy: 'skyet',
  fog: 'tåke', rain: 'regn', lightrain: 'lett regn', heavyrain: 'kraftig regn',
  rainshowers: 'regnbyger', lightrainshowers: 'lette byger', snow: 'snø', sleet: 'sludd',
};
const textFor = (symbol) =>
  TEXT_NO[symbol.replace(/_(day|night|polartwilight)$/, '')] ?? 'skyet';

const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

const symbolOf = (t) =>
  t.data.next_1_hours?.summary.symbol_code ?? t.data.next_6_hours?.summary.symbol_code ?? 'cloudy';

export function normalizeWeather(forecast, sun) {
  const ts = forecast.properties.timeseries;
  const now = ts[0];
  const precip = now.data.next_1_hours?.details.precipitation_amount ?? 0;
  const symbol = symbolOf(now);
  let cloud = (now.data.instant.details.cloud_area_fraction ?? 50) / 100;
  if (precip > 0.1) cloud = Math.max(cloud, 0.8); // rain = desaturated sky

  const at = (i) => ts[Math.min(i, ts.length - 1)];
  const hourly = [2, 4, 6, 8, 10, 12].map((i) => {
    const t = at(i);
    return {
      hour: String(new Date(t.time).getHours()).padStart(2, '0'),
      temp: Math.round(t.data.instant.details.air_temperature),
      icon: iconFor(symbolOf(t)),
    };
  });

  const tm = at(26); // ~tomorrow early afternoon; timeseries is hourly for 48h
  return {
    current: {
      temp: Math.round(now.data.instant.details.air_temperature),
      icon: iconFor(symbol), text: textFor(symbol), precip, cloud,
    },
    hourly,
    sunrise: hhmm(sun.properties.sunrise.time),
    sunset: hhmm(sun.properties.sunset.time),
    tomorrow: {
      temp: Math.round(tm.data.instant.details.air_temperature),
      icon: iconFor(symbolOf(tm)), text: textFor(symbolOf(tm)),
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchWeather(lat, lon) {
  const get = async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.json();
  };
  const date = new Date().toISOString().slice(0, 10);
  const [forecast, sun] = await Promise.all([
    get(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`),
    get(`https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${lat}&lon=${lon}&date=${date}`),
  ]);
  return normalizeWeather(forecast, sun);
}
```

`src/routes/api/weather/+server.js`:

```js
import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchWeather } from '$lib/server/weather.js';

const get = cached(15 * 60_000, () => fetchWeather(config.lat, config.lon));
export const GET = async () => json(await get());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Smoke-test against the real API**

Run `npm run dev`, then:

```bash
curl -s http://localhost:5173/api/weather | head -c 600
```

Expected: JSON with plausible `current.temp` for the configured lat/lon.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/cache.js src/lib/server/weather.js src/routes/api/weather tests/cache.test.js tests/weather.test.js
git commit -m "feat: weather endpoint from api.met.no with stale-on-error cache"
```

---

### Task 4: Calendar endpoint (iCal feeds per person)

**Files:**
- Create: `src/lib/server/calendar.js`, `src/routes/api/calendar/+server.js`
- Test: `tests/calendar.test.js`

**Interfaces:**
- Consumes: `config.people` (Task 1), `cached` (Task 3).
- Produces: `GET /api/calendar` → JSON:

```js
{ people: [ { name: 'Vegard', color: '#C4572E', events: [
    { title: 'Statusmøte', start: '2026-08-24T07:00:00.000Z', end: '...',
      label: 'jobb', allDay: false }
] } ] }
```

  Events cover **today 00:00 through tomorrow 24:00** (local), sorted by start. The `label` is the feed's label so work vs. home events can be styled differently.

- [ ] **Step 1: Write the failing tests**

`tests/calendar.test.js` (fixture .ics inline; includes a plain event, a weekly recurring event, and an EXDATE):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/server/calendar.js`**

```js
import ical from 'node-ical';

// ponytail: EXDATE honored; per-instance RECURRENCE-ID overrides are ignored.
// Add handling of ev.recurrences if moved single instances start showing wrong.
function expand(ev, winStart, winEnd) {
  const dur = ev.end - ev.start;
  if (!ev.rrule) {
    return ev.start < winEnd && ev.end > winStart ? [{ start: ev.start, end: ev.end }] : [];
  }
  const ex = new Set(Object.values(ev.exdate ?? {}).map((d) => +new Date(d)));
  return ev.rrule
    .between(new Date(+winStart - dur), winEnd, true)
    .filter((d) => !ex.has(+d))
    .map((d) => ({ start: d, end: new Date(+d + dur) }));
}

export function eventsFromICS(text, label, winStart, winEnd) {
  const parsed = ical.sync.parseICS(text);
  const out = [];
  for (const ev of Object.values(parsed)) {
    if (ev.type !== 'VEVENT') continue;
    for (const { start, end } of expand(ev, winStart, winEnd)) {
      out.push({
        title: ev.summary ?? '(uten tittel)',
        start: start.toISOString(),
        end: end.toISOString(),
        label,
        allDay: ev.datetype === 'date',
      });
    }
  }
  return out.sort((a, b) => a.start < b.start ? -1 : 1);
}

export async function fetchCalendars(people) {
  const winStart = new Date(); winStart.setHours(0, 0, 0, 0);
  const winEnd = new Date(+winStart + 48 * 3600_000);
  return {
    people: await Promise.all(people.map(async (p) => {
      const perFeed = await Promise.all(p.feeds.map(async (f) => {
        try {
          const res = await fetch(f.url);
          if (!res.ok) throw new Error(`${f.url} -> ${res.status}`);
          return eventsFromICS(await res.text(), f.label, winStart, winEnd);
        } catch (e) {
          console.error('calendar feed failed:', f.url, e.message);
          return []; // one broken feed must not hide the person's other feeds
        }
      }));
      return {
        name: p.name, color: p.color,
        events: perFeed.flat().sort((a, b) => a.start < b.start ? -1 : 1),
      };
    })),
  };
}
```

`src/routes/api/calendar/+server.js`:

```js
import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchCalendars } from '$lib/server/calendar.js';

const get = cached(5 * 60_000, () => fetchCalendars(config.people));
export const GET = async () => json(await get());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/calendar.js src/routes/api/calendar tests/calendar.test.js
git commit -m "feat: per-person iCal calendar endpoint with recurrence expansion"
```

---

### Task 5: Photos endpoint (iCloud shared album)

**Files:**
- Create: `src/lib/server/photos.js`, `src/routes/api/photos/+server.js`
- Test: `tests/photos.test.js`

**Interfaces:**
- Consumes: `config.icloudAlbumToken` (Task 1), `cached` (Task 3).
- Produces: `GET /api/photos` → `{ photos: ['https://...jpg', ...] }` (largest derivative per photo, empty array when no token configured).

**Background — the iCloud shared-album webstream protocol** (token is the part after `#` in a `https://www.icloud.com/sharedalbum/#B0...` share link):
1. `POST https://p23-sharedstreams.icloud.com/{token}/sharedstreams/webstream` with body `{"streamCtag":null}`. Apple may answer **HTTP 330** with a JSON body containing `X-Apple-MMe-Host` — repeat the request against that host.
2. The response lists `photos[]`, each with `photoGuid` and `derivatives` (keyed by size class, each with `width`/`height`/`checksum`).
3. `POST .../sharedstreams/webasseturls` with `{"photoGuids":[...]}` → `items` map from checksum to `{url_location, url_path}`; full URL is `https://{url_location}{url_path}`.

- [ ] **Step 1: Write the failing test** (pure derivative-picking logic; the network part is smoke-tested manually)

`tests/photos.test.js`:

```js
import { test, expect } from 'vitest';
import { pickUrls } from '../src/lib/server/photos.js';

const stream = { photos: [{
  photoGuid: 'g1',
  derivatives: {
    '342':  { width: '342',  checksum: 'small' },
    '2049': { width: '2049', checksum: 'big' },
  },
}] };
const assets = { items: {
  small: { url_location: 'cdn.icloud.com', url_path: '/s.jpg?x=1' },
  big:   { url_location: 'cdn.icloud.com', url_path: '/b.jpg?x=1' },
} };

test('picks the largest derivative and builds a full URL', () => {
  expect(pickUrls(stream, assets)).toEqual(['https://cdn.icloud.com/b.jpg?x=1']);
});

test('skips photos whose asset URL is missing', () => {
  expect(pickUrls(stream, { items: {} })).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/server/photos.js`**

```js
async function apiPost(host, token, path, body) {
  const res = await fetch(`https://${host}/${token}/sharedstreams/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 330 && data['X-Apple-MMe-Host'])
    return apiPost(data['X-Apple-MMe-Host'], token, path, body);
  if (!res.ok) throw new Error(`icloud ${path} -> ${res.status}`);
  return data;
}

export function pickUrls(stream, assets) {
  return (stream.photos ?? [])
    .map((p) => {
      const best = Object.values(p.derivatives ?? {})
        .sort((a, b) => Number(b.width) - Number(a.width))[0];
      const item = best && assets.items?.[best.checksum];
      return item && `https://${item.url_location}${item.url_path}`;
    })
    .filter(Boolean);
}

export async function fetchAlbum(token) {
  if (!token) return { photos: [] };
  const stream = await apiPost('p23-sharedstreams.icloud.com', token, 'webstream', { streamCtag: null });
  const guids = (stream.photos ?? []).map((p) => p.photoGuid);
  const assets = await apiPost('p23-sharedstreams.icloud.com', token, 'webasseturls', { photoGuids: guids });
  return { photos: pickUrls(stream, assets) };
}
```

`src/routes/api/photos/+server.js`:

```js
import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';
import { cached } from '$lib/server/cache.js';
import { fetchAlbum } from '$lib/server/photos.js';

const get = cached(60 * 60_000, () => fetchAlbum(config.icloudAlbumToken));
export const GET = async () => json(await get());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Smoke-test with the real album token** (once the user provides one in `config.json`)

```bash
curl -s http://localhost:5173/api/photos | head -c 400
```

Expected: `{"photos":["https://cvws.icloud-content.com/..."]}`. Without a token: `{"photos":[]}`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/photos.js src/routes/api/photos tests/photos.test.js
git commit -m "feat: iCloud shared-album photos endpoint"
```

---

### Task 6: Reminder selection + client config endpoint

**Files:**
- Create: `src/lib/reminders.js`, `src/routes/api/config/+server.js`
- Test: `tests/reminders.test.js`

**Interfaces:**
- Consumes: reminder objects from config: `{title, subtitle, label, days, from, until}`.
- Produces: `activeReminder(reminders, date)` → the active reminder object or `null`. Active = `date.getDay()` in `days` and local `HH:MM` within `[from, until]`. Several active → earliest `until` (most urgent deadline) wins.
- Produces: `GET /api/config` → `{ modules: [...], reminders: [...] }` — the client-safe config subset (feed URLs and the album token stay server-side).

- [ ] **Step 1: Write the failing tests**

`tests/reminders.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/reminders.js`**

```js
export function activeReminder(reminders, date) {
  const hhmm = date.toTimeString().slice(0, 5);
  const day = date.getDay();
  const active = reminders.filter(
    (r) => r.days.includes(day) && hhmm >= r.from && hhmm <= r.until,
  );
  return active.sort((a, b) => (a.until < b.until ? -1 : 1))[0] ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Implement `src/routes/api/config/+server.js`**

```js
import { json } from '@sveltejs/kit';
import config from '$lib/server/config.js';

export const GET = () => json({ modules: config.modules, reminders: config.reminders });
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/reminders.js src/routes/api/config tests/reminders.test.js
git commit -m "feat: reminder time-window selection and client config endpoint"
```

---

### Task 7: Module registry and layout engine (pure logic)

This is the heart of the module system: which modules render, in what order, and what gets dropped when space runs out — all decided by pure functions with no DOM measurement, so every rule is unit-testable.

**Files:**
- Create: `src/lib/modules.js`
- Test: `tests/modules.test.js`

**Interfaces:**
- Consumes: `activeReminder` (Task 6), `mode` (Task 2).
- Consumes: `ctx` object built by the page: `{ weather, calendar, photos, reminders, now }` where `weather`/`calendar` are the endpoint JSON (or `null` before first load), `photos` is a URL array, `reminders` a reminder array, `now` a Date.
- Produces:
  - `REGISTRY` — `{ [name]: { minHeight, priority, flex, active(ctx) } }` for `clock`, `weather`, `hourly`, `reminder`, `photos`, `calendar`.
  - `calendarView(ctx)` → `{ mode, items }` — the per-mode calendar content (morning: per-person cards; day: next 3 event chips; evening: tomorrow's first event). `items` empty ⇒ nothing to display.
  - `layoutModules(order, ctx, avail = 1776)` → array of rows, each row an array of `{ name, minHeight, priority, flex }`, in config order, containing only enabled + active modules that fit. `avail` is a parameter so tests (and smaller screens) can vary it.
  - `hourOf(date)` → decimal hour.

- [ ] **Step 1: Write the failing tests**

`tests/modules.test.js`:

```js
import { test, expect } from 'vitest';
import { layoutModules, calendarView, REGISTRY } from '../src/lib/modules.js';

const monday = (hhmm) => new Date(`2026-08-24T${hhmm}:00`); // Monday, local
const gym = { title: 'Gymtøy', days: [1], from: '05:30', until: '08:00' };
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
  expect(names(layoutModules(ORDER, ctx()))).toEqual(
    [['clock', 'weather'], ['hourly'], ['reminder'], ['photos'], ['calendar']],
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
  expect(layoutModules(ORDER, ctx()).flat().map((m) => m.name)).toContain('photos');
});

test('calendarView morning: card per person', () => {
  const v = calendarView(ctx());
  expect(v.mode).toBe('morning');
  expect(v.items[0].name).toBe('Vegard');
  expect(v.items[0].next.title).toBe('Statusmøte');
});

test('calendarView day: upcoming chips with who', () => {
  const v = calendarView(ctx({ now: monday('09:30') }));
  expect(v.mode).toBe('day');
  expect(v.items[0]).toMatchObject({ title: 'Statusmøte', who: 'Vegard' });
});

test('calendarView evening: first event tomorrow', () => {
  const v = calendarView(ctx({ now: monday('21:00') }));
  expect(v.mode).toBe('evening');
  expect(v.items[0].title).toBe('Bursdag');
});

test('calendarView with no relevant events has nothing to display', () => {
  const v = calendarView(ctx({ calendar: { people: [] } }));
  expect(v.items).toEqual([]);
});
```

Note on the day-mode test: `Statusmøte` ends 08:00Z = 10:00 local (CEST); at 09:30 local (day mode starts at 09:00) it hasn't ended, so it is "upcoming".

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/modules.js`**

```js
import { activeReminder } from './reminders.js';
import { mode } from './sky.js';

export const hourOf = (d) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

// Per-mode calendar content. Empty items = the module has nothing to display.
export function calendarView(ctx) {
  const now = ctx.now;
  const m = mode(hourOf(now));
  const people = ctx.calendar?.people ?? [];
  const end = new Date(now); end.setHours(24, 0, 0, 0);
  const all = people.flatMap((p) => p.events.map((e) => ({ ...e, who: p.name })));
  const bySt = (a, b) => (a.start < b.start ? -1 : 1);

  if (m === 'day') {
    const upcoming = all
      .filter((e) => !e.allDay && new Date(e.end) > now && new Date(e.start) < end)
      .sort(bySt);
    return { mode: m, items: upcoming.slice(0, 3) };
  }
  if (m === 'evening') {
    const tomorrow = all.filter((e) => new Date(e.start) >= end).sort(bySt)[0];
    return { mode: m, items: tomorrow ? [tomorrow] : [] };
  }
  // morning: one card per person, their first not-yet-ended event today
  const perPerson = people.map((p) => ({
    name: p.name, color: p.color,
    next: p.events.find((e) => !e.allDay && new Date(e.end) > now && new Date(e.start) < end),
  }));
  return { mode: m, items: perPerson.some((p) => p.next) ? perPerson : [] };
}

// minHeight: the design's block heights. priority: what survives when space is
// tight (higher = kept). flex: fills leftover vertical space when rendered.
export const REGISTRY = {
  clock:    { minHeight: 270, priority: 100, flex: false, active: () => true },
  weather:  { minHeight: 240, priority: 80,  flex: false, active: (c) => !!c.weather },
  hourly:   { minHeight: 150, priority: 60,  flex: false, active: (c) => !!c.weather },
  reminder: { minHeight: 460, priority: 90,  flex: true,  active: (c) => !!activeReminder(c.reminders ?? [], c.now) },
  photos:   { minHeight: 500, priority: 10,  flex: true,  active: (c) => (c.photos ?? []).length > 0 },
  calendar: { minHeight: 170, priority: 70,  flex: false, active: (c) => calendarView(c).items.length > 0 },
};

const GAP = 36;

// order: config `modules` array (string = own row, array = side-by-side row).
// Drops the lowest-priority module until everything fits in `avail` px —
// this is why photos only show when there is room.
export function layoutModules(order, ctx, avail = 1776) {
  let rows = order
    .map((entry) => [entry].flat()
      .map((name) => ({ name, ...REGISTRY[name] }))
      .filter((m) => m.active(ctx)))
    .filter((r) => r.length);
  const height = (r) => Math.max(...r.map((m) => m.minHeight));
  const total = () =>
    rows.reduce((s, r) => s + height(r), 0) + GAP * Math.max(0, rows.length - 1);
  while (rows.length && total() > avail) {
    const lowest = rows.flat().sort((a, b) => a.priority - b.priority)[0];
    rows = rows
      .map((r) => r.filter((m) => m.name !== lowest.name))
      .filter((r) => r.length);
  }
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/modules.js tests/modules.test.js
git commit -m "feat: module registry and priority-based layout engine"
```

---

### Task 8: Client data layer + module components + stack renderer

**Files:**
- Create: `src/lib/data.svelte.js`, `src/lib/ui/Icon.svelte`, `src/lib/ui/Clock.svelte`, `src/lib/ui/CurrentWeather.svelte`, `src/lib/ui/HourlyStrip.svelte`, `src/lib/ui/Reminder.svelte`, `src/lib/ui/Photos.svelte`, `src/lib/ui/Calendar.svelte`
- Modify: `src/routes/+page.svelte` (sky background + module stack renderer)

**Interfaces:**
- Consumes: `/api/weather`, `/api/calendar`, `/api/photos`, `/api/config` (Tasks 3–6); `layoutModules`, `calendarView`, `hourOf` (Task 7); `skyAt`, `textColor`, `panelColor`, `mode`, `rgb` (Task 2); `activeReminder` (Task 6).
- Produces (from `data.svelte.js`, all `$state` objects read by components):
  - `clock` → `{ now: Date }` ticking every second; honors `?t=HH:MM` override (frozen time)
  - `weather.v`, `calendar.v`, `photos.v`, `cfg.v` → latest endpoint JSON or `null` before first load
- Produces: `Icon.svelte` with props `name` (`sun|cloudsun|cloud|moon|rain|snow`) and `size`.
- Every module component takes one prop, `panel` (the phase-dependent panel background color string), and renders exactly one module.

- [ ] **Step 1: Implement `src/lib/data.svelte.js`**

```js
// Client-only (page has ssr=false), so setInterval at module scope is safe.
function poll(url, ms) {
  const s = $state({ v: null });
  const go = async () => {
    try { s.v = await (await fetch(url)).json(); } catch { /* keep last value */ }
  };
  go();
  setInterval(go, ms);
  return s;
}

export const weather = poll('/api/weather', 15 * 60_000);
export const calendar = poll('/api/calendar', 5 * 60_000);
export const photos = poll('/api/photos', 60 * 60_000);
export const cfg = poll('/api/config', 60 * 60_000);

const tOverride = new URLSearchParams(location.search).get('t'); // "?t=HH:MM" freezes the clock for previewing phases
const overridden = () => {
  const d = new Date();
  const [h, m] = tOverride.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

export const clock = $state({ now: tOverride ? overridden() : new Date() });
if (!tOverride) setInterval(() => { clock.now = new Date(); }, 1000);
```

- [ ] **Step 2: Implement `src/lib/ui/Icon.svelte`**

Paths for sun/cloudsun/cloud/moon are copied from the design; rain/snow are the matching Lucide outlines (`cloud-rain`, `snowflake`) in the same 24×24 stroke style.

```svelte
<script>
  let { name, size = 32 } = $props();
  const P = {
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
    cloudsun: 'M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z',
    cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
    moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
    rain: 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M16 14v6M8 14v6M12 16v6',
    snow: 'M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d={P[name] ?? P.cloud} />
</svg>
```

- [ ] **Step 3: Implement the six module components**

`src/lib/ui/Clock.svelte` (indoor temperature from the mockup is dropped — no sensor exists):

```svelte
<script>
  import { clock } from '$lib/data.svelte.js';
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateLine = $derived(
    clock.now.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }),
  );
</script>

<div>
  <div class="clock">{pad2(clock.now.getHours())}:{pad2(clock.now.getMinutes())}</div>
  <div class="date">{dateLine[0].toUpperCase() + dateLine.slice(1)}</div>
</div>

<style>
  .clock { font-size: 175px; font-weight: 300; line-height: 0.95; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .date { font-size: 30px; margin-top: 16px; opacity: 0.75; }
</style>
```

`src/lib/ui/CurrentWeather.svelte`:

```svelte
<script>
  import Icon from './Icon.svelte';
  import { clock, weather } from '$lib/data.svelte.js';
  import { hourOf } from '$lib/modules.js';
  import { mode } from '$lib/sky.js';

  let { panel } = $props();
  const w = $derived(weather.v);
  const m = $derived(mode(hourOf(clock.now)));
  const sub = $derived(
    !w ? '' :
    m === 'morning' ? `${w.current.text} · ↑ ${w.sunrise}` :
    m === 'day' ? `${w.current.text} · ${w.current.precip} mm` :
    `${w.current.text} · ↓ ${w.sunset}`,
  );
</script>

{#if w}
  <div class="panel" style="background: {panel}">
    <Icon name={w.current.icon} size={58} />
    <div class="temp">{w.current.temp}°</div>
    <div class="sub">{sub}</div>
  </div>
{/if}

<style>
  .panel { border-radius: 36px; padding: 30px 38px; text-align: center; min-width: 210px; transition: background 2s; }
  .temp { font-size: 50px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .sub { font-size: 22px; opacity: 0.7; }
</style>
```

`src/lib/ui/HourlyStrip.svelte`:

```svelte
<script>
  import Icon from './Icon.svelte';
  import { weather } from '$lib/data.svelte.js';
  let { panel } = $props();
</script>

{#if weather.v}
  <div class="strip" style="background: {panel}">
    {#each weather.v.hourly as h}
      <div class="item">
        <span class="t">{h.hour}</span>
        <Icon name={h.icon} size={32} />
        <span class="temp">{h.temp}°</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .strip { border-radius: 32px; padding: 26px 40px; height: 150px; box-sizing: border-box; display: flex; justify-content: space-between; flex: 1; transition: background 2s; }
  .item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .t { font-size: 21px; opacity: 0.6; }
  .temp { font-size: 25px; font-weight: 600; }
</style>
```

`src/lib/ui/Reminder.svelte` (card styling verbatim from the design; morning = light card, evening = amber-outline dark card):

```svelte
<script>
  import { clock, cfg } from '$lib/data.svelte.js';
  import { activeReminder } from '$lib/reminders.js';
  import { hourOf } from '$lib/modules.js';
  import { mode } from '$lib/sky.js';

  const r = $derived(activeReminder(cfg.v?.reminders ?? [], clock.now));
  const evening = $derived(mode(hourOf(clock.now)) === 'evening');
</script>

{#if r}
  <div class="center">
    <div class="card" class:evening>
      <div class="label">{r.label}</div>
      <div class="title">{r.title}</div>
      {#if r.subtitle}<div class="sub">{r.subtitle}</div>{/if}
    </div>
  </div>
{/if}

<style>
  .center { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .card { background: rgba(255,255,255,0.7); border-radius: 44px; padding: 64px; color: #3A2A20; }
  .label { font-size: 24px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: #C4572E; }
  .title { font-size: 96px; font-weight: 700; line-height: 1.05; margin-top: 14px; }
  .sub { font-size: 30px; margin-top: 14px; opacity: 0.7; }
  .card.evening { background: rgba(255,184,107,0.14); border: 1.5px solid rgba(255,184,107,0.35); color: #F1ECFA; }
  .card.evening .label { color: #FFB86B; }
</style>
```

`src/lib/ui/Photos.svelte` (rotates every 5 minutes, crossfading between images):

```svelte
<script>
  import { fade } from 'svelte/transition';
  import { clock, photos } from '$lib/data.svelte.js';

  const url = $derived.by(() => {
    const urls = photos.v?.photos ?? [];
    if (!urls.length) return null;
    return urls[Math.floor(+clock.now / 300_000) % urls.length];
  });
</script>

{#if url}
  <div class="frame">
    {#key url}
      <img src={url} alt="" in:fade={{ duration: 1500 }} out:fade={{ duration: 1500 }} />
    {/key}
    <div class="credit">Fra bildearkivet</div>
  </div>
{/if}

<style>
  .frame { flex: 1; position: relative; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 44px; }
  .credit { position: absolute; left: 36px; bottom: 30px; font-size: 20px; color: rgba(255,255,255,0.85); text-shadow: 0 1px 8px rgba(0,0,0,0.5); }
</style>
```

`src/lib/ui/Calendar.svelte` (renders whatever `calendarView` selected for the current mode; events from a non-"privat" feed show their label after the title):

```svelte
<script>
  import { clock, calendar, weather } from '$lib/data.svelte.js';
  import { calendarView } from '$lib/modules.js';

  let { panel } = $props();
  const v = $derived(calendarView({ calendar: calendar.v, now: clock.now }));
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const tag = (e) => e.label && e.label !== 'privat' ? ` · ${e.label}` : '';
</script>

<div class="row">
  {#if v.mode === 'morning'}
    {#each v.items as p}
      <div class="card" style="background: {panel}">
        <div class="name" style="color: {p.color}">{p.name}</div>
        <div class="ev">{p.next ? `${hhmm(p.next.start)} ${p.next.title}${tag(p.next)}` : 'Ingen avtaler'}</div>
      </div>
    {/each}
  {:else if v.mode === 'day'}
    {#each v.items as e}
      <div class="chip" style="background: {panel}"><b>{hhmm(e.start)}</b> {e.title} · {e.who}{tag(e)}</div>
    {/each}
  {:else}
    {#each v.items as e}
      <div class="wide" style="background: {panel}">
        I morgen: <b>{e.title} · {e.who} {e.allDay ? '' : hhmm(e.start)}</b>
        {#if weather.v}· {weather.v.tomorrow.text}, {weather.v.tomorrow.temp}°{/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .row { height: 170px; display: flex; gap: 18px; align-items: flex-start; flex: 1; }
  .card { flex: 1; border-radius: 28px; padding: 24px 28px; transition: background 2s; }
  .name { font-size: 24px; font-weight: 700; }
  .ev { font-size: 23px; opacity: 0.75; margin-top: 8px; }
  .chip { border-radius: 28px; padding: 26px 32px; font-size: 27px; transition: background 2s; }
  .wide { border-radius: 28px; padding: 30px 38px; font-size: 27px; opacity: 0.9; width: 100%; box-sizing: border-box; transition: background 2s; }
</style>
```

- [ ] **Step 4: Wire the stack renderer in `src/routes/+page.svelte`**

The page builds `ctx`, asks `layoutModules` what to show, and renders each row. Rows fade in/out as modules appear and disappear.

```svelte
<script>
  import { fade } from 'svelte/transition';
  import Clock from '$lib/ui/Clock.svelte';
  import CurrentWeather from '$lib/ui/CurrentWeather.svelte';
  import HourlyStrip from '$lib/ui/HourlyStrip.svelte';
  import Reminder from '$lib/ui/Reminder.svelte';
  import Photos from '$lib/ui/Photos.svelte';
  import Calendar from '$lib/ui/Calendar.svelte';
  import { clock, weather, calendar, photos, cfg } from '$lib/data.svelte.js';
  import { layoutModules, hourOf } from '$lib/modules.js';
  import { skyAt, textColor, panelColor, rgb } from '$lib/sky.js';

  const COMPONENTS = {
    clock: Clock, weather: CurrentWeather, hourly: HourlyStrip,
    reminder: Reminder, photos: Photos, calendar: Calendar,
  };

  let vw = $state(1080), vh = $state(1920);
  const scale = $derived(Math.min(vw / 1080, vh / 1920));

  const h = $derived(hourOf(clock.now));
  const cloud = $derived(weather.v?.current.cloud ?? 0.3);
  const sky = $derived(skyAt(h, cloud));
  const txt = $derived(textColor(h));
  const panel = $derived(panelColor(h));

  const ctx = $derived({
    weather: weather.v, calendar: calendar.v,
    photos: photos.v?.photos ?? [], reminders: cfg.v?.reminders ?? [],
    now: clock.now,
  });
  const rows = $derived(layoutModules(cfg.v?.modules ?? [], ctx));
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div class="viewport">
  <div class="stage" style="transform: scale({scale}); color: {txt}">
    <div class="sky" style="background: linear-gradient(172deg, {rgb(sky[0])} 0%, {rgb(sky[1])} 52%, {rgb(sky[2])} 100%)"></div>
    <div class="content">
      {#each rows as row (row.map((m) => m.name).join())}
        <div class="mrow" class:grow={row.some((m) => m.flex)}
             transition:fade={{ duration: 1000 }}>
          {#each row as m (m.name)}
            {@const C = COMPONENTS[m.name]}
            <C {panel} />
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  :global(body) { margin: 0; background: #141828; overflow: hidden; cursor: none; }
  .viewport { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
  .stage { width: 1080px; height: 1920px; flex: none; position: relative; overflow: hidden;
           font-family: 'Outfit', sans-serif; transition: color 2s; transform-origin: center; }
  .sky { position: absolute; inset: 0; transition: background 30s linear; }
  .content { position: absolute; inset: 0; padding: 72px; display: flex; flex-direction: column;
             gap: 36px; box-sizing: border-box; }
  .mrow { display: flex; gap: 18px; justify-content: space-between; align-items: flex-start; }
  .mrow.grow { flex: 1; align-items: stretch; }
  .mrow.grow > :global(*) { flex: 1; display: flex; flex-direction: column; }
</style>
```

The sky div's 30s background transition is what makes the background drift smoothly as the clock ticks and the weather updates. The `{#each}` keys mean a row only re-mounts (and fades) when its module set actually changes.

- [ ] **Step 5: Visual check across phases and module configs**

Run `npm run dev` (with real feeds, or the example URLs replaced by a real public .ics):

- `/?t=07:00` — clock+weather side by side, hourly strip, reminder card (if Monday), person cards; photos dropped or below reminder depending on room.
- `/?t=13:00` — photo fills the flexible space, day chips at the bottom.
- `/?t=20:30` — evening colors, evening reminder styling, tomorrow line.
- Edit `config.json`: move `"calendar"` to the front of `modules` → calendar renders at the top. Remove `"photos"` → no photos. Restart dev server (config is read at boot) and verify.
- Temporarily set a reminder window covering now and confirm the reminder appears and the layout reflows with a fade.

- [ ] **Step 6: Run all tests, commit**

```bash
npm test
git add -A
git commit -m "feat: module components and priority-driven stack renderer"
```

---

### Task 9: Raspberry Pi deployment (build, systemd, kiosk)

**Files:**
- Create: `deploy/mat-signage.service`, `deploy/kiosk-autostart`, `README.md`

**Interfaces:**
- Consumes: the adapter-node build output (`build/index.js`).
- Produces: a Pi that boots straight into the dashboard.

- [ ] **Step 1: Verify the production build runs locally**

```bash
npm run build
PORT=3000 node build/index.js
```

Expected: server starts; `http://localhost:3000` shows the dashboard. (`config.json` is read from the working directory — run from the repo root.)

- [ ] **Step 2: Write `deploy/mat-signage.service`**

```ini
[Unit]
Description=mat ambient signage server
After=network-online.target
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/mat
ExecStart=/usr/bin/node build/index.js
Environment=PORT=3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Write `deploy/kiosk-autostart`** (contents for `~/.config/labwc/autostart` on Raspberry Pi OS Bookworm)

```sh
# Rotate to portrait (adjust output name to `wlr-randr` listing) and disable blanking
wlr-randr --output HDMI-A-1 --transform 90 &
# Kiosk browser; crash bubbles and update prompts suppressed
chromium-browser --kiosk --noerrdialogs --disable-session-crashed-bubble \
  --disable-features=TranslateUI --check-for-update-interval=31536000 \
  http://localhost:3000 &
```

- [ ] **Step 4: Write `README.md`** with exactly these sections:

````markdown
# mat — ambient home signage

Full-screen 1080×1920 family dashboard built from ordered, toggleable modules:
weather (yr.no), calendars (iCal), reminders, iCloud photos, with a sky
background that follows the clock and the weather.
Design: docs/design/ambient-scene.jsx.

## Dev

```sh
cp config.example.json config.json   # fill in feeds, position, album token
npm install
npm run dev                          # open the printed URL
npm test
```

Preview any time of day with `?t=HH:MM`, e.g. `http://localhost:5173/?t=21:00`.

## Config

- `lat`/`lon` — forecast position
- `modules` — enabled modules in top-to-bottom screen order; remove an entry to
  disable it; a nested array (e.g. `["clock", "weather"]`) is one side-by-side
  row. Available: `clock`, `weather`, `hourly`, `reminder`, `photos`, `calendar`.
  A module with nothing to show hides itself; when everything doesn't fit,
  the lowest-priority modules (photos first) are dropped.
- `people[].feeds[]` — one or more iCal URLs per person; `label` ("jobb"/"privat")
  is shown on non-private events
- `icloudAlbumToken` — the part after `#` in an iCloud shared-album link
  (`https://www.icloud.com/sharedalbum/#B0xxxx` → `B0xxxx`); empty disables photos
- `reminders[]` — `days` (0=søndag..6=lørdag), `from`/`until` `HH:MM` local

## Raspberry Pi setup (Raspberry Pi OS Bookworm with desktop, 64-bit)

1. Install Node 22:
   ```sh
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
   sudo apt-get install -y nodejs
   ```
2. Get the app onto the Pi and build it:
   ```sh
   git clone <this-repo> /home/pi/mat
   cd /home/pi/mat
   cp config.example.json config.json && nano config.json
   npm ci && npm run build
   ```
3. Server as a service:
   ```sh
   sudo cp deploy/mat-signage.service /etc/systemd/system/
   sudo systemctl enable --now mat-signage
   curl -s localhost:3000/api/weather | head -c 200   # sanity check
   ```
4. Kiosk: enable desktop autologin (`sudo raspi-config` → System → Boot/Auto Login →
   Desktop Autologin), then:
   ```sh
   mkdir -p ~/.config/labwc
   cat deploy/kiosk-autostart >> ~/.config/labwc/autostart
   ```
   Check the HDMI output name with `wlr-randr` and adjust the `--output` flag if
   it isn't `HDMI-A-1`. Disable screen blanking: `sudo raspi-config` → Display →
   Screen Blanking → No.
5. Reboot. The Pi boots into the dashboard.

Updating: `cd /home/pi/mat && git pull && npm ci && npm run build && sudo systemctl restart mat-signage`.
````

- [ ] **Step 5: Deploy to the actual Pi following the README** and verify: dashboard visible in portrait, survives `sudo reboot`, survives pulling the network cable for a minute (screen keeps last data, recovers).

- [ ] **Step 6: Commit**

```bash
git add deploy README.md
git commit -m "feat: Pi deployment — systemd unit, kiosk autostart, setup docs"
```

---

## Deliberately skipped (add when needed)

- Indoor temperature ("21,5° inne" in the mockup) — no sensor/source exists; the date line stands alone.
- Reminder source integration — static config per the request; swap `config.reminders` for a fetcher behind `/api/config` when a source is chosen.
- Config hot-reload — `config.json` is read at server boot; restart the service after edits. Add an fs.watch if editing becomes frequent.
- Sunrise-adjusted sky anchors, per-instance recurrence overrides — marked with `ponytail:` comments at the relevant sites.
- Photo caching/proxying on the server — iCloud asset URLs expire eventually; the hourly `/api/photos` refresh re-fetches fresh URLs, which covers it.
- Module registry stays hard-coded per module — six modules don't need a plugin API; `REGISTRY` + a component map is the whole abstraction.
