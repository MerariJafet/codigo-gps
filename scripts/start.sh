#!/bin/bash
# CÓDIGO GPS — one-command start (backend + frontend)
# Usage:  ./scripts/start.sh
set -e

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v python3 >/dev/null || { echo -e "${RED}python3 no está instalado${NC}"; exit 1; }
command -v npm >/dev/null || { echo -e "${RED}npm no está instalado${NC}"; exit 1; }

echo -e "${CYAN}🌐 CÓDIGO GPS${NC}"

# --- Backend ---------------------------------------------------------------
if [ ! -d ".venv" ]; then
  echo -e "${GREEN}Creando entorno virtual…${NC}"
  python3 -m venv .venv
fi
echo -e "${GREEN}Instalando dependencias del backend…${NC}"
.venv/bin/pip install -q -r backend/requirements.txt

echo -e "${GREEN}Levantando backend en :8000…${NC}"
.venv/bin/python -m uvicorn backend.server.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# --- Frontend --------------------------------------------------------------
cd frontend
if [ ! -d "node_modules" ]; then
  echo -e "${GREEN}Instalando dependencias del frontend…${NC}"
  npm install
fi
echo -e "${GREEN}Levantando frontend en :3000…${NC}"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT"

echo ""
echo -e "${CYAN}✅ Listo → abre http://localhost:3000${NC}"
echo "   (Ctrl+C detiene ambos servicios)"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
