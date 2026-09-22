#!/usr/bin/env bash
set -e

echo "=========================================="
echo "   Building Diwan for Linux Desktop"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "--> [1/2] Building frontend..."
pnpm --filter @workspace/arabic-poetry run build

echo "--> [2/2] Building native Linux desktop application..."
pnpm --filter @workspace/arabic-poetry tauri build --no-bundle

BINARY_PATH="$ROOT_DIR/artifacts/arabic-poetry/src-tauri/target/release/diwan"

echo ""
echo "=========================================="
echo " Build Finished Successfully!"
echo " Executable created at:"
echo " $BINARY_PATH"
echo "=========================================="
echo ""
echo "To run now: $BINARY_PATH"
echo "To add to your Linux Application Menu: bash scripts/install-desktop.sh"
