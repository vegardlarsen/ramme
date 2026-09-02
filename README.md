# ramme — ambient home signage

> ⚠️ This project is 100% vibe-coded.

Full-screen 1080×1920 family dashboard built from ordered, toggleable modules:
weather (yr.no), calendars (iCal), reminders, iCloud photos, with a sky
background that follows the clock and the weather.
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
   git clone https://github.com/vegardlarsen/ramme.git /home/pi/ramme
   cd /home/pi/ramme
   cp config.example.json config.json && nano config.json
   npm ci && npm run build
   ```
3. Server as a service:
   ```sh
   sudo cp deploy/ramme-signage.service /etc/systemd/system/
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
sudo apt-get install -y cage chromium-browser
sudo cp deploy/ramme-kiosk.service /etc/systemd/system/
sudo systemctl enable ramme-kiosk
sudo reboot
```

The unit takes over tty1 (`Conflicts=getty@tty1.service`), so no autologin
setup is needed, and there is nothing to blank the screen. Portrait rotation
happens inside the unit via `wlr-randr`; as with the desktop variant, adjust
the `--output` name in `deploy/ramme-kiosk.service` if it isn't `HDMI-A-1`.

Caveats: these steps assume the browser binary is `chromium-browser` and the user
account is `pi`, both true on older Raspberry Pi OS images. Newer images may install
it as `chromium` instead — check with `command -v chromium chromium-browser` and
adjust `deploy/kiosk-autostart` or `deploy/ramme-kiosk.service` accordingly. If
the first-boot wizard created a different username, adjust `User=` in the
`deploy/*.service` units and the `/home/pi/ramme` paths above to match.

Updating: `cd /home/pi/ramme && git pull && npm ci && npm run build && sudo systemctl restart ramme-signage`.
