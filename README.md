# ramme — ambient home signage

> ⚠️ This project is 100% vibe-coded.

Full-screen 1080×1920 family dashboard built from ordered, toggleable modules:
weather (yr.no), calendars (iCal), reminders, iCloud photos, with a light
or dark theme following the day's actual sunrise and sunset.
Design: docs/design/ambient-scene.jsx.

## Dev

```sh
cp config.example.json config.json   # fill in feeds, position, album token
npm install
npm run dev                          # open the printed URL
npm test
```

Preview any time of day with `?t=HH:MM`, e.g. `http://localhost:5173/?t=21:00`.

## Config

- `lat`/`lon` — forecast position
- `modules` — enabled modules in top-to-bottom screen order; remove an entry to
  disable it; a nested array (e.g. `["clock", "weather"]`) is one side-by-side
  row. Available: `clock`, `weather`, `hourly`, `reminder`, `photos`, `calendar`.
  A module with nothing to show hides itself; when everything doesn't fit,
  the lowest-priority modules (photos first) are dropped.
- `people[].feeds[]` — one or more iCal URLs per person; `label` ("jobb"/"privat")
  is shown on non-private events
- `brightness` — optional screen-brightness schedule, `"HH:MM": percent`; each
  level holds until the next entry (wrapping past midnight), and `0` puts the
  monitor in standby until the next non-zero entry. Applied via
  `ddcutil` over DDC/CI, so it needs `ddcutil` installed, the `i2c-dev` kernel
  module loaded, and passwordless sudo on the Pi; omit to disable
- `departures` — public-transport groups watched for deviations (Entur
  realtime, no API key). No timetable is shown; a disruption notice or a
  cancelled upcoming departure raises a card in the reminder area (overline
  "Avvik", title = `label`). Per group: `label`, `stop` (NSR stop place id —
  find it via `https://api.entur.io/geocoder/v1/autocomplete?text=...`),
  `lines` (Entur line ids to whitelist), optional `destination` (keep only
  departures with this front text, e.g. one direction of a boat) and `count`
  (upcoming departures checked for cancellation, default 3); omit to disable
- `icloudAlbumToken` — the part after `#` in an iCloud shared-album link
  (`https://www.icloud.com/sharedalbum/#B0xxxx` → `B0xxxx`); empty disables photos
- `photoIntervalMinutes` — how long each photo stays on screen (default 60)

## Reminders

Any event in a configured feed can raise a reminder card by carrying a
`!remind` line in its description:

```
!remind 12 hours
Sett ut dunken kvelden før
```

- `!remind N min|hours|days` — how long before the event the card appears;
  bare number means hours, bare `!remind` means 12 hours
- Optional `+ N min|hours|days` keeps the card up that long **after** the
  event ends: `!remind 12 hours + 4 hours`
- The card shows the event's title, plus the rest of the description as the
  smaller line; without a `+` part it disappears when the event ends
- The overline label is automatic: "I kveld" the day before, "Før HH:MM" on
  the day itself

When several reminders are active at once, the one with the earliest
deadline shows.

## Raspberry Pi setup (Raspberry Pi OS Bookworm with desktop, 64-bit)

1. Install Node 22:
   ```sh
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
   sudo apt-get install -y nodejs
   ```
2. Get the app onto the Pi and build it:
   ```sh
   git clone https://github.com/vegardlarsen/ramme.git ~/ramme
   cd ~/ramme
   cp config.example.json config.json && nano config.json
   npm ci && npm run build
   ```
3. Server as a service:
   ```sh
   sed "s|/home/pi|$HOME|; s|^User=pi|User=$USER|" deploy/ramme-signage.service | sudo tee /etc/systemd/system/ramme-signage.service >/dev/null
   sudo systemctl enable --now ramme-signage
   curl -s localhost:3000/api/weather | head -c 200   # sanity check
   ```
4. Kiosk: enable desktop autologin (`sudo raspi-config` → System → Boot/Auto Login →
   Desktop Autologin), then:
   ```sh
   mkdir -p ~/.config/labwc
   cat deploy/kiosk-autostart >> ~/.config/labwc/autostart
   ```
   Check the HDMI output name with `wlr-randr` and adjust the `--output` flag if
   it isn't `HDMI-A-1`. Disable screen blanking: `sudo raspi-config` → Display →
   Screen Blanking → No.
5. Reboot. The Pi boots into the dashboard.

### Variant: Raspberry Pi OS Lite (no desktop)

Runs the browser under [cage](https://github.com/cage-kiosk/cage), a Wayland
compositor that shows exactly one full-screen app — no desktop session at all.
Steps 1–3 above are the same; instead of steps 4–5:

```sh
sudo apt-get install -y cage wlr-randr chromium-browser || sudo apt-get install -y cage wlr-randr chromium
sed "s|^User=pi|User=$USER|" deploy/ramme-kiosk.service | sudo tee /etc/systemd/system/ramme-kiosk.service >/dev/null
sudo cp deploy/99-ramme-no-pointer.rules /etc/udev/rules.d/   # no mouse -> no cursor
sudo systemctl enable ramme-kiosk
sudo reboot
```

The unit takes over tty1 (`Conflicts=getty@tty1.service`), so no autologin
setup is needed, and there is nothing to blank the screen. Portrait rotation
happens inside the unit via `wlr-randr`; as with the desktop variant, adjust
the `--output` name in `deploy/ramme-kiosk.service` if it isn't `HDMI-A-1`.

Caveats: the kiosk files find the browser whether it is installed as `chromium`
or `chromium-browser` (the name changed between Raspberry Pi OS releases). The
service files ship with `pi` as a placeholder username; the `sed | sudo tee`
install commands above substitute whatever user runs them, so any username the
OS installer created works — just run the install as that user, with the repo
cloned at `~/ramme`.

Updating: `~/ramme/update.sh` (pulls, rebuilds, restarts both services).
