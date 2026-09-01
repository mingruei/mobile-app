#!/bin/bash
set -e
cd "$(dirname "$0")/../.."
if [ ! -d node_modules ]; then
  npm install
fi
(sleep 1.5 && open "http://127.0.0.1:3456") &
npm run bigplayer:start
