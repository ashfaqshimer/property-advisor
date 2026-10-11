#!/usr/bin/env bash
# Runs Property Advisor backend (FastAPI) and frontend (Next.js) concurrently with unified logs.
set -euo pipefail

# ANSI color codes
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Check prerequisites
command -v uv >/dev/null 2>&1 || { echo -e "${RED}[error] 'uv' is not installed or not in PATH.${NC}"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}[error] 'pnpm' is not installed or not in PATH.${NC}"; exit 1; }

if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}[error] Backend directory not found: $BACKEND_DIR${NC}"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}[error] Frontend directory not found: $FRONTEND_DIR${NC}"
    exit 1
fi

echo -e "=================================================="
echo -e "${CYAN} Starting Property Advisor Dev Servers${NC}"
echo -e "   Backend:  http://localhost:8000"
echo -e "   Frontend: http://localhost:3000"
echo -e "${YELLOW} Press Ctrl+C to stop both servers.${NC}"
echo -e "=================================================="

export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8
export PYTHONUNBUFFERED=1

cleanup() {
    trap - SIGINT SIGTERM EXIT
    echo -e "\n${YELLOW}Stopping servers...${NC}"
    if [ -n "${BACKEND_PID:-}" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "${FRONTEND_PID:-}" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo -e "${GREEN}All servers stopped.${NC}"
}

trap cleanup SIGINT SIGTERM EXIT

# Start backend
(
    cd "$BACKEND_DIR"
    uv run fastapi dev app/main.py 2>&1 | while IFS= read -r line; do
        printf "%b %s\n" "${CYAN}[backend]${NC}" "$line"
    done
) &
BACKEND_PID=$!

# Start frontend
(
    cd "$FRONTEND_DIR"
    pnpm dev 2>&1 | while IFS= read -r line; do
        printf "%b %s\n" "${MAGENTA}[frontend]${NC}" "$line"
    done
) &
FRONTEND_PID=$!

# Wait for background processes
wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
