#!/bin/bash

echo "Checking Backend (http://localhost:8000/health)..."
if curl -s -f http://localhost:8000/health > /dev/null; then
    echo "Backend is UP"
else
    echo "Backend is DOWN"
    exit 1
fi

echo "Checking Frontend (http://localhost:3000)..."
if curl -s -f http://localhost:3000 > /dev/null; then
    echo "Frontend is UP"
else
    echo "Frontend is DOWN"
    exit 1
fi

echo "All systems operational."
exit 0
