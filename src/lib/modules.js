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
      .filter((name) => REGISTRY[name])
      .map((name) => ({ name, ...REGISTRY[name] }))
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
  return rows;
}
