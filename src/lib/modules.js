import { activeReminder } from './reminders.js';
import { mode } from './sky.js';

export const hourOf = (d) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

// One column per person: a static view of the whole day (finished events stay,
// marked `done`; ongoing ones marked `now`); from 20:00 the view switches to
// tomorrow's agenda (`tomorrow: true`). Empty items = nothing to show = the
// module hides itself.
export function calendarView(ctx) {
  const now = ctx.now;
  const people = ctx.calendar?.people ?? [];
  const tomorrow = now.getHours() >= 20;
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  if (tomorrow) dayStart.setDate(dayStart.getDate() + 1);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const items = people.map((p) => {
    const events = p.events.filter((e) =>
      new Date(e.start) >= dayStart && new Date(e.start) < dayEnd);
    return { name: p.name,
             color: /^#[0-9a-f]{6}$/i.test(p.color ?? '') ? p.color : undefined, events,
             allDay: events.filter((e) => e.allDay),
             timed: lanes(events.filter((e) => !e.allDay)) };
  });
  if (!items.some((p) => p.events.length)) return { tomorrow, items: [], hours: [] };
  // Shared timeline: hour-rounded span of everyone's timed events, clamped to
  // 07–23, min 3h so a lone short event doesn't fill the whole card.
  // ponytail: hour-rounding epoch ms assumes a whole-hour UTC offset (true for Oslo)
  const HOUR = 3_600_000;
  const timed = items.flatMap((p) => p.timed);
  if (!timed.length) return { tomorrow, items, hours: [] };
  const winStart = new Date(dayStart); winStart.setHours(7);
  const winEnd = new Date(dayStart); winEnd.setHours(23);
  const t0raw = Math.max(+winStart, Math.floor(Math.min(...timed.map((e) => e.ms)) / HOUR) * HOUR);
  const t1 = Math.min(+winEnd, Math.ceil(Math.max(...timed.map((e) => e.msEnd)) / HOUR) * HOUR);
  const t0 = Math.min(t0raw, Math.max(+winStart, t1 - 3 * HOUR));
  const span = t1 - t0;
  const clamp = (f) => Math.min(1, Math.max(0, f));
  for (const e of timed) {
    e.top = clamp((e.ms - t0) / span);
    e.height = clamp((e.msEnd - t0) / span) - e.top;
    e.done = e.msEnd <= +now;
    e.now = e.ms <= +now && +now < e.msEnd;
  }
  const step = span / HOUR > 8 ? 2 : 1;
  const hours = [];
  for (let t = t0; t <= t1; t += step * HOUR)
    hours.push({ label: String(new Date(t).getHours()).padStart(2, '0'), frac: (t - t0) / span });
  return { tomorrow, items, hours };
}

// Horizontal variant: time runs left→right, one row per person. Stretches
// with no events in any calendar for more than an hour are cut out and drawn
// as a narrow break, so one late event doesn't stretch the whole axis.
export function timelineView(ctx) {
  const v = calendarView(ctx);
  const timed = v.items.flatMap((p) => p.timed).sort((a, b) => a.ms - b.ms);
  if (!timed.length) return { ...v, ticks: [], breaks: [] };
  const HOUR = 3_600_000, CUT = HOUR, BREAK = HOUR / 2;
  const busy = [];
  for (const e of timed) {
    const last = busy.at(-1);
    if (last && e.ms - last[1] <= CUT) last[1] = Math.max(last[1], e.msEnd);
    else busy.push([e.ms, e.msEnd]);
  }
  // hour-rounded segments; rounding can make neighbours touch, so merge again
  const segs = [];
  for (const [a, b] of busy) {
    const start = Math.floor(a / HOUR) * HOUR, end = Math.ceil(Math.max(b, a + 1) / HOUR) * HOUR;
    const last = segs.at(-1);
    if (last && start <= last.end) last.end = end; else segs.push({ start, end });
  }
  let off = 0;
  for (const s of segs) { s.off = off; off += s.end - s.start + BREAK; }
  const total = off - BREAK;
  const x = (ms) => {
    const s = segs.find((s) => ms <= s.end);
    return (s.off + ms - s.start) / total;
  };
  for (const e of timed) { e.left = x(e.ms); e.width = x(e.msEnd) - e.left; }
  // labels may run past a short block, up to the person's next event
  for (const p of v.items) for (const e of p.timed)
    e.room = (p.timed.find((o) => o.ms >= e.msEnd && o !== e)?.left ?? 1) - e.left;
  const step = total / HOUR > 10 ? 2 : 1;
  const ticks = segs.flatMap((s) => {
    const out = [];
    for (let t = s.start; t <= s.end; t += step * HOUR)
      out.push({ label: String(new Date(t).getHours()).padStart(2, '0'), frac: x(t) });
    return out;
  });
  const breaks = segs.slice(1).map((s) => ({ left: (s.off - BREAK) / total, width: BREAK / total }));
  return { ...v, ticks, breaks };
}

// Side-by-side lanes for a person's own overlapping events: greedy lane
// assignment; every event in a connected overlap cluster shares its lane count.
function lanes(evs) {
  const sorted = evs.map((e) => ({ ...e, ms: +new Date(e.start), msEnd: +new Date(e.end) }))
    .sort((a, b) => a.ms - b.ms);
  let cluster = [], clusterEnd = -Infinity;
  const flush = () => {
    const ends = [];
    for (const e of cluster) {
      let i = ends.findIndex((end) => end <= e.ms);
      if (i === -1) i = ends.length;
      ends[i] = e.msEnd;
      e.lane = i;
    }
    for (const e of cluster) e.lanes = ends.length;
    cluster = [];
  };
  for (const e of sorted) {
    if (e.ms >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.msEnd);
  }
  flush();
  return sorted;
}

// Subtitle under the current temperature: sunrise in the morning, precipitation
// by day, sunset in the evening.
export function currentSub(w, now) {
  const m = mode(hourOf(now));
  return m === 'morning' ? `${w.current.text} · ↑ ${w.sunrise}` :
    m === 'day' ? `${w.current.text} · ${w.current.precip} mm` :
    `${w.current.text} · ↓ ${w.sunset}`;
}

export const rainAhead = (c) => (c.nowcast ?? []).some((p) => p.mm > 0);

// Smooth line through midpoints (quadratic beziers), yr-style, in a 100x100
// viewBox; 2 mm/h floor so drizzle doesn't render as a full-height graph.
export function nowcastPath(pts) {
  if (pts.length < 2) return '';
  const max = Math.max(2, ...pts.map((p) => p.mm));
  const xy = pts.map((p, i) => [(i / (pts.length - 1)) * 100, 98 - (p.mm / max) * 88]);
  let d = `M ${xy[0][0]} ${xy[0][1]}`;
  for (let i = 1; i < xy.length - 1; i++)
    d += ` Q ${xy[i][0]} ${xy[i][1]} ${(xy[i][0] + xy[i + 1][0]) / 2} ${(xy[i][1] + xy[i + 1][1]) / 2}`;
  return d + ` L ${xy[xy.length - 1][0]} ${xy[xy.length - 1][1]}`;
}

// One line the kiosk viewer actually needs: when does the rain stop or start?
// Points are 5-minute steps starting now; '' = no useful headline.
export function nowcastHeadline(pts) {
  if (!pts?.length) return '';
  if (pts[0].mm > 0) {
    let i = pts.length;
    while (i > 0 && pts[i - 1].mm === 0) i--;
    return i < pts.length ? `opphold om ca. ${i * 5} min` : '';
  }
  const start = pts.findIndex((p) => p.mm > 0);
  return start > 0 ? `regn om ca. ${start * 5} min` : '';
}

// Timeline's on-screen footprint, mirroring Timeline.svelte's sizes: head 42 +
// card padding/axis 66 − the 48px it bleeds into the page's bottom padding,
// plus per person a row gap (10) and LANE px per lane, +28 for an all-day chip line.
// ponytail: assumes chips fit on one line; measure the DOM if they start wrapping
export const LANE = 58;
const timelineHeight = (c) => 60 + calendarView(c).items.reduce((sum, p) =>
  sum + 10 + LANE * Math.max(1, ...p.timed.map((e) => e.lanes)) + (p.allDay.length ? 28 : 0), 0);

// minHeight: the design's block heights (a function = computed from ctx). priority: what survives when space is
// tight (higher = kept). flex: fills leftover vertical space when rendered.
export const REGISTRY = {
  clock:    { minHeight: 166, priority: 100, flex: false, active: () => true },
  // nowcast swaps in for the weather widget while rain is on the radar
  weather:  { minHeight: 270, priority: 80,  flex: false, active: (c) => !!c.weather && !rainAhead(c) },
  hourly:   { minHeight: 185, priority: 60,  flex: false, active: (c) => !!c.weather },
  // top-edge strip: nowcast/current conditions + hourly; footprint = 170 − 48 bleed
  weatherbar: { minHeight: 122, priority: 80, flex: false, active: (c) => !!c.weather },
  nowcast:  { minHeight: 270, priority: 80,  flex: false, active: rainAhead },
  reminder: { minHeight: 460, priority: 90,  flex: true,  active: (c) => !!activeReminder(c.reminders ?? [], c.now) },
  photos:   { minHeight: 500, priority: 10,  flex: true,  active: (c) => (c.photos ?? []).length > 0 },
  calendar: { minHeight: 460, priority: 70,  flex: true,  active: (c) => calendarView(c).items.length > 0 },
  timeline: { minHeight: timelineHeight, priority: 70,  flex: false, active: (c) => calendarView(c).items.length > 0 },
};

const GAP = 36;

// order: config `modules` array (string = own row, array = side-by-side row).
// Drops the lowest-priority module until everything fits in `avail` px —
// this is why photos only show when there is room.
export function layoutModules(order, ctx, avail = 1824) {
  let rows = order
    .map((entry) => [entry].flat()
      .filter((name) => REGISTRY[name])
      .map((name) => ({ name, ...REGISTRY[name] }))
      .map((m) => typeof m.minHeight === 'function' ? { ...m, minHeight: m.minHeight(ctx) } : m)
      .filter((m) => m.active(ctx)))
    .filter((r) => r.length);
  const height = (r) => Math.max(...r.map((m) => m.minHeight));
  const total = () =>
    rows.reduce((s, r) => s + height(r), 0) + GAP * Math.max(0, rows.length - 1);

  const computeSaving = (moduleName) => {
    // Find which row contains this module
    const rowIdx = rows.findIndex((r) => r.some((m) => m.name === moduleName));
    if (rowIdx === -1) return 0;

    const row = rows[rowIdx];
    const oldHeight = height(row);
    const newRow = row.filter((m) => m.name !== moduleName);

    if (newRow.length === 0) {
      // Removing this module removes the entire row; save row height + gap
      const gapSaved = rowIdx < rows.length - 1 ? GAP : 0;
      return oldHeight + gapSaved;
    } else {
      // Row still has members; saving only if this was the tallest
      const newHeight = height(newRow);
      return oldHeight - newHeight;
    }
  };

  while (rows.length && total() > avail) {
    const allModules = rows.flat();

    // Find modules that save space when removed
    const modulesThatSaveSpace = allModules.filter((m) => computeSaving(m.name) > 0);

    if (modulesThatSaveSpace.length === 0) break;

    // Drop the one with lowest priority among those that save space
    const toRemove = modulesThatSaveSpace.sort((a, b) => a.priority - b.priority)[0];

    rows = rows
      .map((r) => r.filter((m) => m.name !== toRemove.name))
      .filter((r) => r.length);
  }

  // Flex modules learn the room they actually have: their row's budget plus an
  // equal share of the leftover space. Photos uses this to size (and pick) images.
  const flexRows = rows.filter((r) => r.some((m) => m.flex));
  const share = flexRows.length ? Math.max(0, avail - total()) / flexRows.length : 0;
  for (const r of flexRows) for (const m of r) m.maxHeight = Math.round(height(r) + share);

  return rows;
}
