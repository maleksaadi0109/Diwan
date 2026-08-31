# Self-contained Windows packaging

This document explains how to produce a Windows installer that works with
no separate Python, FFmpeg, or yt-dlp install on the target machine. It must
be followed on an actual Windows machine (or a `windows-latest` GitHub
Actions runner) -- this repl's sandbox is Linux and cannot cross-compile a
Windows Tauri bundle or run PyInstaller for a Windows target.

## What gets bundled

| Dependency | How it's bundled | Bundled at |
|---|---|---|
| Python + worker code + faster-whisper + yt-dlp | Frozen into a single `diwan_worker.exe` (PyInstaller, one-dir mode) | `worker-dist/` resource dir |
| FFmpeg | Static Windows binary, bundled as a resource | `bin/win/ffmpeg.exe` |
| ffprobe | Static Windows binary, bundled as a resource | `bin/win/ffprobe.exe` |

yt-dlp does **not** need a separate binary: it's a pure-Python package
already imported in-process by the worker (`import yt_dlp`), so freezing
the worker with PyInstaller bundles it automatically as long as it's listed
in `worker/pyproject.toml` (it is) and PyInstaller's `collect_all` step
picks it up (the provided spec file does this explicitly, since yt-dlp does
a lot of dynamic/plugin-style importing that PyInstaller's static analysis
alone would miss).

The Rust side (`src-tauri/src/commands/worker.rs`) already knows how to use
these bundles: on Windows it looks for `worker-dist/diwan_worker.exe` and
`bin/win/{ffmpeg,ffprobe}.exe` under the app's resource directory and, if
found, runs the frozen worker directly and passes it the bundled ffmpeg/
ffprobe paths via `DIWAN_FFMPEG_PATH` / `DIWAN_FFPROBE_PATH` environment
variables (read by `worker/diwan_worker/bin_paths.py`). If those resources
are absent (e.g. a plain `cargo tauri dev` on Windows without running the
steps below), it transparently falls back to searching PATH for a system
Python/ffmpeg/ffprobe install, exactly like before this change -- so dev
workflows are unaffected.

## One-time or per-release steps (run on Windows)

All paths below are relative to `artifacts/arabic-poetry/`.

### 1. Freeze the Python worker

```powershell
cd worker
python -m venv .venv
.venv\Scripts\activate
pip install -e .[build]
pyinstaller diwan_worker.windows.spec
```

This produces `worker/dist/diwan_worker/` containing `diwan_worker.exe`
plus its DLLs/data files (PyInstaller one-dir mode -- deliberately not
one-file, since unpacking a one-file archive on every worker invocation
adds multi-second startup latency, which is noticeable for a
request/response worker that gets spawned repeatedly).

Copy the **entire folder contents** (not just the .exe) to:

```
src-tauri/windows-dist/worker/
```

### 2. Get static FFmpeg/ffprobe binaries

Download a static Windows build (e.g. from
https://www.gyan.dev/ffmpeg/builds/ -- the "essentials" or "full" build,
either works) and copy just the two binaries to:

```
src-tauri/windows-dist/bin/ffmpeg.exe
src-tauri/windows-dist/bin/ffprobe.exe
```

Confirm the license terms for whichever build you choose are compatible
with how this app will be distributed (FFmpeg's own binaries are
LGPL/GPL depending on which codecs are enabled in the specific build).

### 3. Confirm the layout

```
src-tauri/windows-dist/
  bin/
    ffmpeg.exe
    ffprobe.exe
  worker/
    diwan_worker.exe
    ... (PyInstaller-generated support files/DLLs)
```

`src-tauri/tauri.windows.conf.json` maps this `windows-dist/` folder onto
the app's bundled resources only when building for Windows -- it does not
affect Linux/macOS builds, and `windows-dist/` is git-ignored (these are
large, platform-specific, regeneratable binaries, not source).

### 4. Build the installer

```powershell
pnpm install
pnpm --filter @workspace/arabic-poetry tauri build -- --target x86_64-pc-windows-msvc
```

This produces the NSIS installer under
`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.

## Verifying on a real Windows machine (cannot be done from this sandbox)

After installing the built app on a clean Windows VM/machine **with no
Python, FFmpeg, or yt-dlp installed and not on PATH**, confirm:

- The app launches and the diagnostics page (Settings) reports the worker,
  ffmpeg, and ffprobe as healthy, showing bundled paths rather than
  "unavailable".
- Importing a local audio file, running transcription/alignment, and
  downloading a YouTube video's audio all work end-to-end.
- Uninstalling the app removes `worker-dist`/`bin/win` along with everything
  else (no separate FFmpeg/Python install was made system-wide, so nothing
  should be left behind).

This verification step is also tracked as a standalone follow-up project
task ("Confirm the new diagnostics tools actually work in a built desktop
app", which now also covers this Windows packaging path) since this
sandbox has no Windows target or Cargo toolchain to build or run against.
