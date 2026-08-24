// Client-only (page has ssr=false), so setInterval at module scope is safe.
function poll(url, ms) {
  const s = $state({ v: null });
  const go = async () => {
    try {
      const res = await fetch(url);
      if (res.ok) s.v = await res.json();
    } catch { /* keep last value */ }
    if (s.v === null) setTimeout(go, 15_000); // fast retry until first success (boot races)
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
