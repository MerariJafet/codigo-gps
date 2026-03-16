#!/bin/bash
cd /home/merari-acero/Escritorio/codigo\ GPS
docker-compose up -d backend
cd frontend
npm run dev
