#!/usr/bin/env bash
# Rebuilds jsbridge/bundle.js: game-logic (TS, source of truth) bundled for the embedded goja runtime.
# Uses the workspace esbuild (node_modules/.bin) when present, else npx.
set -euo pipefail
cd "$(dirname "$0")/../../.."
if [ -x node_modules/.bin/esbuild ]; then ESBUILD=node_modules/.bin/esbuild; else ESBUILD="npx esbuild"; fi
$ESBUILD packages/server-go/jsbridge/entry.ts --bundle --format=iife --target=es2017 \
  --alias:@datacenter-tycoon/game-logic=./packages/game-logic/src/index.ts \
  --outfile=packages/server-go/jsbridge/bundle.js
