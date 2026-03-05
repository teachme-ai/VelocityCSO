#!/bin/sh
# start.sh — Launch Python charts sidecar, wait for health, then start Node.js

set -e

echo "{\"severity\":\"INFO\",\"system\":\"velocity_cso\",\"message\":\"start.sh | initializing | pid=$$\"}"

# ── Start Python sidecar in background ───────────────────────────────────────
cd /app/charts-service
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --log-level info &
PYTHON_PID=$!
echo "{\"severity\":\"INFO\",\"system\":\"velocity_cso\",\"message\":\"start.sh | python_sidecar_started | pid=${PYTHON_PID}\"}"

# ── Poll /health until sidecar is ready (max 30s) ────────────────────────────
RETRIES=30
until wget -qO- http://localhost:8001/health > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "{\"severity\":\"WARNING\",\"system\":\"velocity_cso\",\"message\":\"start.sh | python_sidecar_health_timeout | starting_node_anyway\"}"
        break
    fi
    echo "{\"severity\":\"INFO\",\"system\":\"velocity_cso\",\"message\":\"start.sh | waiting_for_sidecar | retries_left=${RETRIES}\"}"
    sleep 1
done

echo "{\"severity\":\"INFO\",\"system\":\"velocity_cso\",\"message\":\"start.sh | python_sidecar_ready | starting_node\"}"

# ── Start Node.js app (foreground — PID 1) ────────────────────────────────────
cd /app
exec node dist/index.js
