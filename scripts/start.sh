#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "► Installing backend dependencies…"
cd "$ROOT/backend" && npm install

echo "► Installing dashboard dependencies…"
cd "$ROOT/dashboard" && npm install

echo "► Building dashboard…"
cd "$ROOT/dashboard" && npm run build

echo "► Starting PM2 apps…"
cd "$ROOT" && pm2 start ecosystem.config.js

pm2 save
echo "✓ crypto-bot started. Dashboard → http://localhost:3082  Backend → http://localhost:8082"
