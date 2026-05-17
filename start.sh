#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Splunk KnowBot — local startup script
# Starts Python backend on :8000 and frontend dev server on :5173
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
VENV="$BACKEND_DIR/.venv"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Splunk KnowBot — Local Startup"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Python backend ────────────────────────────────────────────────────────────
echo "1. Setting up Python backend…"
cd "$BACKEND_DIR"

if [ ! -d "$VENV" ]; then
  echo "   Creating virtual environment…"
  python3 -m venv .venv
fi

source "$VENV/bin/activate"
echo "   Installing Python dependencies…"
pip install -r requirements.txt -q

echo "   Starting FastAPI on http://localhost:8000"
uvicorn main:app --reload --port 8000 --host 0.0.0.0 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
sleep 2

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo "2. Setting up frontend…"
cd "$SCRIPT_DIR"

# Write .env if not present
if [ ! -f .env ]; then
  echo "   Creating .env with VITE_API_BASE_URL=http://localhost:8000"
  echo "VITE_API_BASE_URL=http://localhost:8000" > .env
fi

if [ ! -d node_modules ]; then
  echo "   Installing npm packages…"
  npm install
fi

echo "   Starting Vite dev server on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "═══════════════════════════════════════════════════"
echo "  KnowBot is running!"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API docs:  http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo "═══════════════════════════════════════════════════"
echo ""

trap "echo 'Stopping…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
