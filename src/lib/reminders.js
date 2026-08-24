export function activeReminder(reminders, date) {
  const hhmm = date.toTimeString().slice(0, 5);
  const day = date.getDay();
  const active = reminders.filter(
    (r) => r.days.includes(day) && hhmm >= r.from && hhmm <= r.until,
  );
  return active.sort((a, b) => (a.until < b.until ? -1 : 1))[0] ?? null;
}
