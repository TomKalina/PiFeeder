#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

export AUTO_START_STREAM=true

cd frontend
npm install
npm run build
cd ..

deno run --allow-net --allow-read --allow-write backend/server.ts
