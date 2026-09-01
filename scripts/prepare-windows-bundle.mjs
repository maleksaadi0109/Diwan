// Mandatory pre-build gate for Windows packaging. Fetches (or verifies) the
// bundled offline Whisper model and makes sure the other required
// Windows-only resources (frozen worker exe, ffmpeg/ffprobe) are present
// before `tauri build` runs. Fails loudly and stops the build rather than
// silently producing an installer that falls back to requiring internet on
// first run -- see artifacts/arabic-poetry/WINDOWS_PACKAGING.md.
//
// Cross-platform on purpose (this repo's build entry points run from both
// PowerShell and cmd.exe on Windows): plain Node, no shell-only syntax.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const arabicPoetryDir = path.join(__dirname, "..", "artifacts", "arabic-poetry");
const workerDir = path.join(arabicPoetryDir, "worker");
const windowsDistDir = path.join(arabicPoetryDir, "src-tauri", "windows-dist");

function fail(message) {
  console.error(`\n[prepare-windows-bundle] ERROR: ${message}\n`);
  process.exit(1);
}

function pythonCandidates() {
  return process.platform === "win32"
    ? ["python.exe", "python3.exe", "py.exe"]
    : ["python3", "python"];
}

function runFetchModelScript() {
  const scriptPath = path.join(workerDir, "scripts", "fetch_bundled_model.py");
  for (const python of pythonCandidates()) {
    const result = spawnSync(python, [scriptPath], {
      stdio: "inherit",
      cwd: workerDir,
    });
    if (result.error) {
      // Try the next interpreter candidate (mirrors the Rust worker's own
      // python_command_candidates() fallback list).
      continue;
    }
    if (result.status !== 0) {
      fail(
        "fetch_bundled_model.py failed -- the Windows build cannot proceed " +
          "without the offline speech model. See output above for details."
      );
    }
    return;
  }
  fail(
    "Could not find a Python interpreter to run fetch_bundled_model.py. " +
      "Install Python 3.10+ (with `pip install huggingface_hub`) and re-run."
  );
}

function requireResource(relativePath, hint) {
  const fullPath = path.join(windowsDistDir, relativePath);
  if (!existsSync(fullPath)) {
    fail(`Missing required Windows bundle resource: ${relativePath}\n  ${hint}`);
  }
}

runFetchModelScript();

// Sanity-check the other resources this build depends on too, so a missing
// one fails clearly here instead of producing a broken or online-only
// installer that only surfaces the problem on a user's machine.
requireResource(
  path.join("models", "small", "model.bin"),
  "Run `python worker/scripts/fetch_bundled_model.py` from artifacts/arabic-poetry/."
);
requireResource(
  path.join("worker", "diwan_worker.exe"),
  "Freeze the worker with PyInstaller -- see WINDOWS_PACKAGING.md step 1."
);
requireResource(
  path.join("bin", "ffmpeg.exe"),
  "Copy a static ffmpeg.exe build -- see WINDOWS_PACKAGING.md step 2."
);
requireResource(
  path.join("bin", "ffprobe.exe"),
  "Copy a static ffprobe.exe build -- see WINDOWS_PACKAGING.md step 2."
);

console.log("[prepare-windows-bundle] All required Windows bundle resources are present.");
