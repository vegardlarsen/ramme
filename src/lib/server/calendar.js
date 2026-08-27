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

// "!remind", "!remind 3", "!remind 90 min", "!remind 2 days" on its own line
// in the event description. Bare number = hours; bare !remind = 12 hours.
const REMIND = /^\s*!remind(?:\s+(\d+)\s*(min(?:ute)?s?|h(?:our)?s?|d(?:ay)?s?)?)?\s*$/im;

export function parseRemind(description = '') {
  const m = REMIND.exec(description);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 12;
  const unit = (m[2] ?? 'h')[0];
  const leadMs = n * (unit === 'm' ? 60_000 : unit === 'd' ? 86_400_000 : 3_600_000);
  const subtitle = description.replace(REMIND, '').replace(/\n{2,}/g, '\n').trim() || null;
  return { leadMs, subtitle };
}

export function eventsFromICS(text, label, winStart, winEnd) {
  const parsed = ical.sync.parseICS(text);
  const out = [];
  for (const ev of Object.values(parsed)) {
    if (ev.type !== 'VEVENT') continue;
    const remind = parseRemind(ev.description ?? '');
    for (const { start, end } of expand(ev, winStart, winEnd)) {
      out.push({
        title: ev.summary ?? '(uten tittel)',
        start: start.toISOString(),
        end: end.toISOString(),
        label,
        allDay: ev.datetype === 'date',
        ...(remind && {
          subtitle: remind.subtitle,
          remind: { from: new Date(+start - remind.leadMs).toISOString() },
        }),
      });
    }
  }
  return out.sort((a, b) => a.start < b.start ? -1 : 1);
}

export async function fetchCalendars(people) {
  const winStart = new Date(); winStart.setHours(0, 0, 0, 0);
  const winEnd = new Date(winStart);
  winEnd.setDate(winEnd.getDate() + 2);
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
