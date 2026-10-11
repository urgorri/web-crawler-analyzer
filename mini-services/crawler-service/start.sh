#!/bin/bash
# Start crawler service with auto-restart
cd "$(dirname "$0")"

while true; do
  echo "[$(date)] Starting crawler service..."
  bun run index.ts
  EXIT_CODE=$?
  echo "[$(date)] Crawler service exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
