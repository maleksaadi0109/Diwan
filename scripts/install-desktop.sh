#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BINARY_SRC="$ROOT_DIR/artifacts/arabic-poetry/src-tauri/target/release/diwan"
ICON_SRC="$ROOT_DIR/artifacts/arabic-poetry/src-tauri/icons/icon.png"

if [ ! -f "$BINARY_SRC" ]; then
    echo "Error: Binary not found at $BINARY_SRC. Building it first..."
    bash "$SCRIPT_DIR/build-linux.sh"
fi

echo "--> Installing Diwan to ~/.local/bin..."
mkdir -p "$HOME/.local/bin"
rm -f "$HOME/.local/bin/diwan"
cp "$BINARY_SRC" "$HOME/.local/bin/diwan"
chmod +x "$HOME/.local/bin/diwan"

echo "--> Installing worker to ~/.local/share/diwan/worker..."
mkdir -p "$HOME/.local/share/diwan"
cp -r "$ROOT_DIR/artifacts/arabic-poetry/worker" "$HOME/.local/share/diwan/"

echo "--> Installing icon to ~/.local/share/icons..."
mkdir -p "$HOME/.local/share/icons/hicolor/512x512/apps"
cp "$ICON_SRC" "$HOME/.local/share/icons/hicolor/512x512/apps/diwan.png"
cp "$ICON_SRC" "$HOME/.local/share/icons/diwan.png"

echo "--> Creating .desktop launcher in ~/.local/share/applications..."
mkdir -p "$HOME/.local/share/applications"

cat <<EOF > "$HOME/.local/share/applications/diwan.desktop"
[Desktop Entry]
Name=ديوان (Diwan)
GenericName=Arabic Poetry & Audio Alignment
Comment=Arabic Poetry Platform with synchronized speech alignment and background playback
Exec=$HOME/.local/bin/diwan
Icon=diwan
Terminal=false
Type=Application
Categories=AudioVideo;Audio;Player;Education;
StartupWMClass=diwan
EOF

chmod +x "$HOME/.local/share/applications/diwan.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

echo "=========================================================="
echo " Diwan has been installed to your Linux system!"
echo " You can now launch it directly from:"
echo " 1. Your App Launcher / Applications Menu (search 'Diwan' or 'ديوان')"
echo " 2. Or by typing 'diwan' in any terminal"
echo "=========================================================="
