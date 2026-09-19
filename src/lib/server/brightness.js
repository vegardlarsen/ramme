import { execFile } from 'node:child_process';

// schedule: { "07:00": 100, "21:00": 30 } — level applies from that time
// until the next entry (wrapping past midnight).
export function levelAt(schedule, now) {
	const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	const times = Object.keys(schedule).sort();
	if (times.length === 0) return null;
	const past = times.filter((t) => t <= hhmm);
	return schedule[past.length ? past[past.length - 1] : times[times.length - 1]];
}

// ponytail: monitor has no backlight API; DDC/CI via sudo ddcutil (needs
// passwordless sudo, or put the service user in the i2c group and drop sudo)
const ddc = (args, then) =>
	execFile('sudo', ['-n', 'ddcutil', 'setvcp', ...args], (err) => {
		if (err) console.error(`brightness: ddcutil failed: ${err.message}`);
		else then?.();
	});

let applied = null;
export function applyBrightness(schedule, now = new Date()) {
	const level = levelAt(schedule, now);
	if (level === null || level === applied) return;
	applied = level;
	if (level === 0) {
		ddc(['d6', '4']); // standby — the monitor keeps powering the Pi's USB
	} else {
		ddc(['d6', '1'], () => ddc(['10', String(level)])); // wake, then dim
	}
}

export function startBrightnessSchedule(schedule) {
	applyBrightness(schedule);
	setInterval(() => applyBrightness(schedule), 60_000);
}
