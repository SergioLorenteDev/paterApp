#!/usr/bin/env bash
set -euo pipefail

# La raiz se deduce de la ubicacion del propio script, para que funcione
# en cualquier maquina o ruta donde se clone el repositorio.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$ROOT_DIR/.tools/node/bin:$PATH"
export COREPACK_HOME="$ROOT_DIR/.tools/corepack"

cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "No se encontro el runtime de Node en $ROOT_DIR/.tools/node/bin"
  exit 1
fi

corepack pnpm install

# Open browser on macOS. Ignore failures in restricted environments.
( sleep 2; open http://localhost:3000 ) >/dev/null 2>&1 || true

exec corepack pnpm -r --parallel dev
