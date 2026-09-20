// Reminders come from calendar events carrying a "!remind" line (see
// calendar.js); each is an absolute window {fromAt, untilAt, startAt}.
export function activeReminder(reminders, date) {
  const active = reminders.filter(
    (r) => +new Date(r.fromAt) <= +date && +date <= +new Date(r.untilAt),
  );
  return active.sort((a, b) => +new Date(a.untilAt) - +new Date(b.untilAt))[0] ?? null;
}

// Entur deviations (disruption notices or cancelled upcoming departures) as
// reminder objects: active now, `untilAt: now` = earliest possible deadline,
// so they outrank calendar reminders while they last.
export function transitReminders(departures, now) {
  const hhmm = (iso) =>
    new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  return (departures ?? []).flatMap((g) => {
    const msgs = [
      ...g.situations,
      ...g.calls.filter((c) => c.cancelled).map((c) => `Avgang ${hhmm(c.aimed)} innstilt`),
    ];
    return msgs.length
      ? [{ title: g.label, subtitle: msgs.join(' · '), label: 'Avvik', fromAt: 0, untilAt: +now }]
      : [];
  });
}

export const allReminders = (calendar, departures, now) =>
  [...calendarReminders(calendar), ...transitReminders(departures, now)];

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
