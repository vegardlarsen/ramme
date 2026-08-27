// Two reminder shapes: static config reminders use weekly windows
// ({days, from: 'HH:MM', until: 'HH:MM'}); calendar-derived ones use absolute
// times ({fromAt, untilAt} ISO strings). Earliest deadline wins.
export function activeReminder(reminders, date) {
  const hhmm = date.toTimeString().slice(0, 5);
  const day = date.getDay();
  const todayAt = (t) => {
    const d = new Date(date);
    const [h, m] = t.split(':');
    d.setHours(+h, +m, 0, 0);
    return +d;
  };
  const deadline = (r) => (r.days ? todayAt(r.until) : +new Date(r.untilAt));
  const active = reminders.filter((r) => r.days
    ? r.days.includes(day) && hhmm >= r.from && hhmm <= r.until
    : +new Date(r.fromAt) <= +date && +date <= +new Date(r.untilAt));
  return active.sort((a, b) => deadline(a) - deadline(b))[0] ?? null;
}

// Calendar events carrying a "!remind" line, as reminder objects.
export function calendarReminders(calendar) {
  return (calendar?.people ?? [])
    .flatMap((p) => p.events)
    .filter((e) => e.remind)
    .map((e) => ({
      title: e.title, subtitle: e.subtitle ?? null,
      fromAt: e.remind.from, untilAt: e.remind.until, startAt: e.start,
    }));
}
