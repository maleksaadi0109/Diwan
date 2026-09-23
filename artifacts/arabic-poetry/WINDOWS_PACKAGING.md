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
| Whisper "tiny" speech model (CTranslate2-converted) | Pre-downloaded model folder, bundled as a resource | `models/tiny/` |

yt-dlp does **not** need a separate binary: it's a pure-Python package
already imported in-process by the worker (`import yt_dlp`), so freezing
the worker with PyInstaller bundles it automatically as long as it's listed
in `worker/pyproject.toml` (it is) and PyInstaller's `collect_all` step
picks it up (the provided spec file does this explicitly, since yt-dlp does
a lot of dynamic/plugin-style importing that PyInstaller's static analysis
alone would miss).

The Rust side (`src-tauri/src/commands/worker.rs`) already knows how to use
these bundles: on Windows it looks for `worker-dist/diwan_worker.exe`,
`bin/win/{ffmpeg,ffprobe}.exe`, and a `models/` folder under the app's
resource directory and, if found, runs the frozen worker directly and
passes it the bundled ffmpeg/ffprobe paths via `DIWAN_FFMPEG_PATH` /
`DIWAN_FFPROBE_PATH` environment variables (read by
`worker/diwan_worker/bin_paths.py`) and the bundled models folder via
`DIWAN_BUNDLED_MODELS_DIR` (read by
`worker/diwan_worker/asr/transcriber.py`). If those resources are absent
(e.g. a plain `cargo tauri dev` on Windows without running the steps
below), it transparently falls back to searching PATH for a system
Python/ffmpeg/ffprobe install and downloading the Whisper model from the
Hugging Face Hub on first use, exactly like before this change -- so dev
workflows are unaffected.

### Why bundle the Whisper model too

Without the requested model, the very first transcription on a fresh install
still needs to download its Whisper model from the Hugging
Face Hub before it can run (subsequent runs use the cached copy under
`~/.cache/diwan/models`, or `DIWAN_MODELS_DIR` if set). On a machine with
no internet access, or a flaky one where the download itself keeps
resetting (see the retry/backoff logic already in `transcriber.py`),
first-run transcription simply cannot succeed no matter how many retries
are attempted. Bundling the model turns that "download on first use" into
"already there," matching how ffmpeg/ffprobe and the worker exe itself are
handled.

`worker/diwan_worker/asr/transcriber.py` checks `DIWAN_BUNDLED_MODELS_DIR`
for a `<model_size>/model.bin` folder and, when present, passes that local
directory straight to `WhisperModel(...)` -- faster-whisper only talks to
the network when given a model name/ID, never when given an existing
directory, so this path never touches the internet. Import and unspecified
transcription calls use `tiny`. Other sizes are only downloaded if explicitly
requested; they are not included in the Windows installer.

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

### 3. Pre-download the Whisper AI Model for 100% Offline Use

To ensure the import flows use their intended model without a runtime download,
pre-download `tiny` on the Windows build machine:

```powershell
# From artifacts/arabic-poetry:
python worker/scripts/fetch_bundled_model.py --model-size tiny
```

This creates `src-tauri/windows-dist/models/tiny/` with its weights and
tokenizers. The `tauri:build:windows` command checks it automatically and
downloads the model if missing.

### 4. Confirm the layout

```
src-tauri/windows-dist/
  bin/
    ffmpeg.exe
    ffprobe.exe
  worker/
    diwan_worker.exe
    ... (PyInstaller-generated support files/DLLs)
  models/
    tiny/
      model.bin
      config.json
      tokenizer.json
      vocabulary.txt
```

`src-tauri/tauri.windows.conf.json` maps only `windows-dist/models/tiny/`
into the Windows resources. If an older build left a
`windows-dist/models/small/` folder on your machine, that folder is **not**
included in the new installer; you may delete it manually to reclaim local
disk space. `windows-dist/` is git-ignored because it holds large generated
resources rather than source files.

### 5. Build the installer

```powershell
pnpm install
pnpm --filter @workspace/arabic-poetry run tauri:build:windows
```

This produces the NSIS installer under
`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.

## Bundle size / build-time tradeoff

Only the `tiny` model (approximately 75 MB before compression) is bundled
to keep the installer smaller while making current transcription flows
work offline on first run. The frozen worker and FFmpeg binaries also
contribute to installer size. Explicitly requesting a larger model will
still download it on first use; it will not be available offline.

## Verifying on a real Windows machine (cannot be done from this sandbox)

After installing the built app on a clean Windows VM/machine **with no
Python, FFmpeg, or yt-dlp installed, not on PATH, and with networking
disabled**, confirm:

- The app launches and the diagnostics page (Settings) reports the worker,
  ffmpeg, and ffprobe as healthy, showing bundled paths rather than
  "unavailable".
- Importing a local audio file and running transcription succeed on the
  very first run, with no network access at all (downloading a YouTube
  video's audio obviously still needs a connection, but transcription and
  alignment of already-local audio should not).
- Uninstalling the app removes `worker-dist`/`bin/win`/`models` along with
  everything else (no separate FFmpeg/Python install was made system-wide,
  so nothing should be left behind).

This verification step is also tracked as a standalone follow-up project
task ("Confirm the new diagnostics tools actually work in a built desktop
app", which now also covers this Windows packaging path) since this
sandbox has no Windows target or Cargo toolchain to build or run against.
