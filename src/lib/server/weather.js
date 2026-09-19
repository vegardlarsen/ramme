const UA = 'ramme-signage/1.0 vegard@beat.no';

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
      symbol: symbolOf(t),
    };
  });

  // "I morgen" means tomorrow's daytime weather, not now+26h (which drifts into
  // tomorrow night in the evening). Pick tomorrow's entry closest to local noon.
  const tomorrowDate = new Date(now.time);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = tomorrowDate.toDateString();
  const tomorrowEntries = ts.filter((t) => new Date(t.time).toDateString() === tomorrowKey);
  const tm = tomorrowEntries.length
    ? tomorrowEntries.reduce((best, t) =>
        Math.abs(new Date(t.time).getHours() - 12) < Math.abs(new Date(best.time).getHours() - 12) ? t : best)
    : ts[ts.length - 1];
  return {
    current: {
      temp: Math.round(now.data.instant.details.air_temperature),
      symbol, text: textFor(symbol), precip, cloud,
    },
    hourly,
    sunrise: hhmm(sun.properties.sunrise.time),
    sunset: hhmm(sun.properties.sunset.time),
    tomorrow: {
      temp: Math.round(tm.data.instant.details.air_temperature),
      symbol: symbolOf(tm), text: textFor(symbolOf(tm)),
    },
    updatedAt: new Date().toISOString(),
  };
}

export const normalizeNowcast = (data) =>
  data.properties.timeseries.map((t) => ({
    time: t.time,
    mm: t.data.instant.details.precipitation_rate ?? 0, // mm/h, 5-min steps
  }));

export async function fetchNowcast(lat, lon) {
  const res = await fetch(
    `https://api.met.no/weatherapi/nowcast/2.0/complete?lat=${lat}&lon=${lon}`,
    { headers: { 'User-Agent': UA } });
  if (!res.ok) return []; // 422 = outside Nordic radar coverage
  return normalizeNowcast(await res.json());
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
