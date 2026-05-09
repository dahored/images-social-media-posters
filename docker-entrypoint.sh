#!/bin/sh
set -e

DATA_DIR="/app/data"
DEFAULTS_DIR="/app/data-defaults"

if [ ! -f "$DATA_DIR/config.json" ]; then
  echo "[entrypoint] First run — initializing data directory..."
  mkdir -p "$DATA_DIR/brands" "$DATA_DIR/accounts" "$DATA_DIR/exports"

  # Copy default networks catalog
  cp "$DEFAULTS_DIR/networks.json" "$DATA_DIR/networks.json"

  # Seed files the app expects to exist on first read
  echo '{"telegram":{"botToken":"","defaultChatId":""}}' > "$DATA_DIR/config.json"
  echo '{"carousels":[]}' > "$DATA_DIR/carousels.json"
  echo '{"templates":[]}' > "$DATA_DIR/templates.json"
  echo '{"actions":[]}' > "$DATA_DIR/staged-actions.json"
  echo '{"presets":[]}' > "$DATA_DIR/style-presets.json"
  echo '{"grids":[]}' > "$DATA_DIR/grids.json"
  echo '{"brands":[]}' > "$DATA_DIR/brands.json"
  echo '{"accounts":[]}' > "$DATA_DIR/accounts.json"
  echo '[entrypoint] Data directory initialized.'
fi

mkdir -p /app/public/uploads

exec "$@"
