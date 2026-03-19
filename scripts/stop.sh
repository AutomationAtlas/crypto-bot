#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "► Stopping crypto-bot PM2 apps…"
cd "$ROOT" && pm2 stop ecosystem.config.js
echo "✓ crypto-bot stopped."
