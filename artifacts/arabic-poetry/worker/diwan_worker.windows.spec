# PyInstaller spec for freezing the Diwan Python worker into a single,
# self-contained Windows executable (no system Python required).
#
# Usage (on a Windows machine or a Windows GitHub Actions runner, from
# `artifacts/arabic-poetry/worker`, with the worker's own deps installed --
# see WINDOWS_PACKAGING.md):
#
#   pip install -e .[build]
#   pyinstaller diwan_worker.windows.spec
#
# Output: dist/diwan_worker/diwan_worker.exe (onedir build; onefile is
# avoidable-slow to start for a Whisper model load, so this uses onedir and
# the packaging step below zips the whole folder's *contents* into the
# location Tauri expects it -- see WINDOWS_PACKAGING.md step 4).
#
# The entry point is `run_worker.py`, not `diwan_worker/cli.py` directly:
# cli.py uses package-relative imports, so running it as a script/__main__
# (which is what both a plain interpreter and PyInstaller's script-entry
# mode do) fails with "attempted relative import with no known parent
# package". run_worker.py imports diwan_worker.cli as a normal package
# submodule instead, which keeps its relative imports valid.
#
# faster-whisper (via ctranslate2) and yt-dlp both do a fair amount of
# dynamic/plugin-style importing that PyInstaller's static analysis misses,
# so both are collected wholesale rather than relying on autodetected
# hidden imports.

# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
hiddenimports = []

for pkg in ("faster_whisper", "ctranslate2", "yt_dlp"):
    pkg_datas, pkg_binaries, pkg_hiddenimports = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hiddenimports

a = Analysis(
    ["run_worker.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="diwan_worker",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # the worker communicates over stdio; must stay a console app
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="diwan_worker",
)
