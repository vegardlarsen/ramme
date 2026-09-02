// Two fixed themes, switched by expected daylight: light between sunrise and
// sunset (met.no sunrise API, already in the weather data), dark otherwise.
export const THEMES = {
  light: {
    sky: 'linear-gradient(172deg, #ddf0fb 0%, #fdfeff 52%, #f4fafe 100%)',
    text: 'rgb(23,52,69)',
    panel: 'rgba(23,52,69,0.06)',
  },
  dark: {
    sky: 'linear-gradient(172deg, #1a2040 0%, #101424 52%, #1e142a 100%)',
    text: 'rgb(241,236,250)',
    panel: 'rgba(255,255,255,0.08)',
  },
};

const toH = (hhmm, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? +m[1] + +m[2] / 60 : fallback;
};

// ponytail: hard flip at sunrise/sunset, softened only by the page's CSS
// transition; add a twilight offset (e.g. ±30 min) if the flip feels abrupt.
export function isDaylight(h, weather) {
  return h >= toH(weather?.sunrise, 7) && h < toH(weather?.sunset, 21);
}

export const themeAt = (h, weather) => THEMES[isDaylight(h, weather) ? 'light' : 'dark'];

export function mode(h) {
  return h < 4.5 || h >= 19.5 ? 'evening' : h < 9 ? 'morning' : 'day';
}
