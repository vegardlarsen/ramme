#!/bin/bash
# Update ramme on the pi: pull, rebuild, restart. Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")"

git pull
npm ci
npm run build
sudo systemctl restart ramme-signage ramme-kiosk
