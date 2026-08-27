// Reminders come from calendar events carrying a "!remind" line (see
// calendar.js); each is an absolute window {fromAt, untilAt, startAt}.
export function activeReminder(reminders, date) {
  const active = reminders.filter(
    (r) => +new Date(r.fromAt) <= +date && +date <= +new Date(r.untilAt),
  );
  return active.sort((a, b) => +new Date(a.untilAt) - +new Date(b.untilAt))[0] ?? null;
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
