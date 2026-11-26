#!/bin/zsh
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Electron wordt eenmalig geïnstalleerd…"
  npm install
fi
npm start
