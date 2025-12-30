#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting CÓDIGO GPS Local Development Stack${NC}"

# Check dependencies
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 is not installed.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

# Start Backend
echo -e "${GREEN}>> Setting up Backend...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "Installing requirements..."
pip install -r requirements.txt > /dev/null

echo "Starting Uvicorn..."
# Run from root context for module resolution?
# If we run from backend/, we need PYTHONPATH=.. or similar if modules assume root package.
# But we changed imports to 'backend...'.
# If I run `uvicorn backend.main:app` from backend/, it fails.
# I must run from ROOT.
cd ..
# We are at root.
source backend/venv/bin/activate
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}Backend running (PID: $BACKEND_PID)${NC}"

# Start Frontend
echo -e "${GREEN}>> Starting Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing node modules..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend running (PID: $FRONTEND_PID)${NC}"

echo -e "${GREEN}Stack ready! Access at http://localhost:3000${NC}"
echo "Press Ctrl+C to stop both services."

trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM
wait
