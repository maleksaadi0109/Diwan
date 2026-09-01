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
| Whisper "small" speech model (CTranslate2-converted) | Pre-downloaded/converted model folder, bundled as a resource | `models/small/` |

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

Without a bundled model, the very first transcription on a fresh install
still needs to download the ~250MB "small" Whisper model from the Hugging
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
directory, so this path never touches the internet.

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

### 3. Fetch the pre-converted Whisper "small" model

This is the one step that still needs an internet connection -- it only
runs once per release, on the build machine, not on the end user's
machine. It is scripted (not a manual copy-paste) so every release
reproducibly bundles the same, verified model files:

```powershell
cd worker
.venv\Scripts\activate
pip install huggingface_hub
python scripts\fetch_bundled_model.py
```

`worker/scripts/fetch_bundled_model.py` downloads the CTranslate2-converted
model from a **pinned Hugging Face Hub revision** (not "main", so the
bundle can't silently drift between releases) into
`src-tauri/windows-dist/models/small/`, then verifies the required files
(`model.bin`, `config.json`, `tokenizer.json`, a vocabulary file) are
present, non-empty, and not a truncated/partial download before declaring
success. Re-running it is idempotent -- it skips the download if a valid
copy is already there (`--force` to re-fetch anyway), and `--verify-only`
checks an existing bundle without downloading.

If a different `model_size` is ever selected in the app (e.g. "medium"),
add its repo ID + pinned revision to `MODEL_SOURCES` in that script and run
it with `--model-size medium` -- `transcriber.py` looks up the bundled
folder by whichever size string it's asked to load.

**This step (along with the ffmpeg/worker-exe resources above) is also
enforced automatically.** `scripts/build-windows.ps1` / `.bat` and the
`pnpm --filter @workspace/arabic-poetry run tauri:build:windows` script
both run `scripts/prepare-windows-bundle.mjs` before invoking `tauri
build`, which calls this fetch/verify script and checks the other
resources are present. If anything required is missing, the build stops
with a clear error instead of silently producing an installer that falls
back to requiring internet on first run.

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
    small/
      model.bin
      config.json
      tokenizer.json
      vocabulary.json (or vocabulary.txt)
      preprocessor_config.json
```

`src-tauri/tauri.windows.conf.json` maps this `windows-dist/` folder onto
the app's bundled resources only when building for Windows -- it does not
affect Linux/macOS builds, and `windows-dist/` is git-ignored (these are
large, platform-specific, regeneratable binaries, not source).

### 5. Build the installer

```powershell
pnpm install
pnpm --filter @workspace/arabic-poetry tauri build -- --target x86_64-pc-windows-msvc
```

This produces the NSIS installer under
`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.

## Bundle size / build-time tradeoff

Bundling the "small" model adds roughly 500MB-1GB to the installer
(faster-whisper's CTranslate2-converted "small" model is ~500MB on disk;
exact size varies slightly by conversion/quantization). Combined with the
already-bundled frozen worker exe and ffmpeg/ffprobe, this makes for a
noticeably larger NSIS installer and a longer `tauri build` step (more
files to compress into the bundle), plus one extra scripted download step
per release. This is a deliberate tradeoff: it is what makes the app
capable of transcribing offline on a brand-new install rather than only
after a successful first download, which matters most for exactly the
low-connectivity/flaky-network machines this feature targets. If installer
size becomes a problem later, an alternative is to bundle only a smaller
model size (e.g. "base") and let "small"/"medium" remain download-on-first-
use.

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
