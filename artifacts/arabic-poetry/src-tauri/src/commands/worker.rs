use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkerRequestPayload {
    pub id: String,
    pub command: String,
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkerResponsePayload {
    #[serde(rename = "type", default = "default_response_type")]
    pub msg_type: String,
    pub id: String,
    pub success: bool,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
    #[serde(default)]
    pub error_code: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub progress: Option<f64>,
}

fn default_response_type() -> String {
    "response".to_string()
}

pub struct WorkerState {
    pub is_running: Mutex<bool>,
}

impl Default for WorkerState {
    fn default() -> Self {
        Self {
            is_running: Mutex::new(false),
        }
    }
}

/// Dynamically locates the Python worker directory (`worker/diwan_worker`)
fn resolve_worker_dir() -> PathBuf {
    // 1. Explicit environment variable
    if let Ok(val) = std::env::var("DIWAN_WORKER_DIR") {
        let p = PathBuf::from(val);
        if p.join("diwan_worker").exists() {
            return p;
        }
    }

    // 2. Relative paths from current working directory
    let relative_candidates = [
        "worker",
        "../worker",
        "../../worker",
        "artifacts/arabic-poetry/worker",
        "../../artifacts/arabic-poetry/worker",
    ];

    if let Ok(cwd) = std::env::current_dir() {
        for candidate in &relative_candidates {
            let p = cwd.join(candidate);
            if p.join("diwan_worker").exists() {
                return p;
            }
        }
    }

    // 3. Search relative to current executable
    if let Ok(exe) = std::env::current_exe() {
        let mut cur = exe.parent();
        while let Some(dir) = cur {
            for candidate in &relative_candidates {
                let p = dir.join(candidate);
                if p.join("diwan_worker").exists() {
                    return p;
                }
            }
            cur = dir.parent();
        }
    }

    // Fallback default
    PathBuf::from("worker")
}

/// Candidate Python launcher commands, tried in order. Windows Python
/// installs typically only provide `python.exe`/`py.exe`, not
/// `python3.exe`, while Linux/macOS conventionally provide `python3`.
/// Trying a short list keeps one binary working across all desktop
/// platforms without requiring the user to alias anything.
fn python_command_candidates() -> Vec<(&'static str, Vec<&'static str>)> {
    #[cfg(target_os = "windows")]
    {
        vec![
            ("python.exe", vec![]),
            ("python3.exe", vec![]),
            ("py.exe", vec!["-3"]),
        ]
    }
    #[cfg(not(target_os = "windows"))]
    {
        vec![("python3", vec![]), ("python", vec![])]
    }
}

/// Resolves the frozen, self-contained Windows worker executable bundled as
/// a Tauri resource (see `tauri.windows.conf.json` and
/// `WINDOWS_PACKAGING.md`), if the packaged app actually includes one. Dev
/// builds and platforms other than Windows always return `None` and fall
/// back to invoking a system Python interpreter (`spawn_worker_process`'s
/// existing behavior), so nothing changes for Linux/macOS or for Windows
/// dev machines that haven't run the freeze step.
#[cfg(target_os = "windows")]
fn resolve_frozen_worker_exe(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve("worker-dist/diwan_worker.exe", BaseDirectory::Resource)
        .ok()
        .filter(|p| p.exists())
}

#[cfg(not(target_os = "windows"))]
fn resolve_frozen_worker_exe(_app: &AppHandle) -> Option<PathBuf> {
    None
}

/// Resolves a bundled binary (ffmpeg.exe/ffprobe.exe) under the app's
/// resource directory on Windows. Returns `None` when running in dev, on a
/// non-Windows platform, or when the resource simply isn't bundled, in
/// which case callers fall back to letting the worker resolve the bare
/// command name via PATH exactly as before.
#[cfg(target_os = "windows")]
fn resolve_bundled_bin(app: &AppHandle, filename: &str) -> Option<PathBuf> {
    app.path()
        .resolve(format!("bin/win/{}", filename), BaseDirectory::Resource)
        .ok()
        .filter(|p| p.exists())
}

#[cfg(not(target_os = "windows"))]
fn resolve_bundled_bin(_app: &AppHandle, _filename: &str) -> Option<PathBuf> {
    None
}

fn spawn_worker_process(app: &AppHandle, worker_dir: &PathBuf) -> Result<std::process::Child, String> {
    let ffmpeg_path = resolve_bundled_bin(app, "ffmpeg.exe");
    let ffprobe_path = resolve_bundled_bin(app, "ffprobe.exe");

    // On Windows, prefer a frozen, self-contained worker executable (built
    // via PyInstaller, see WINDOWS_PACKAGING.md) so no system Python
    // install is required at all. It still needs the bundled ffmpeg/
    // ffprobe paths passed through env vars, exactly like the Python
    // source path below.
    if let Some(frozen_exe) = resolve_frozen_worker_exe(app) {
        let mut command = Command::new(&frozen_exe);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .env("PYTHONIOENCODING", "utf-8")
            .stderr(Stdio::inherit());
        if let Some(p) = &ffmpeg_path {
            command.env("DIWAN_FFMPEG_PATH", p);
        }
        if let Some(p) = &ffprobe_path {
            command.env("DIWAN_FFPROBE_PATH", p);
        }
        return command.spawn().map_err(|e| {
            format!(
                "Failed to start bundled worker executable {:?}: {}",
                frozen_exe, e
            )
        });
    }

    let mut last_err: Option<String> = None;

    for (cmd, extra_args) in python_command_candidates() {
        let mut args: Vec<&str> = extra_args;
        args.extend(["-m", "diwan_worker.cli"]);

        let mut command = Command::new(cmd);
        command
            .args(&args)
            .env("PYTHONPATH", worker_dir)
            .current_dir(worker_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .env("PYTHONIOENCODING", "utf-8")
            .stderr(Stdio::inherit());
        if let Some(p) = &ffmpeg_path {
            command.env("DIWAN_FFMPEG_PATH", p);
        }
        if let Some(p) = &ffprobe_path {
            command.env("DIWAN_FFPROBE_PATH", p);
        }

        match command.spawn() {
            Ok(child) => return Ok(child),
            Err(e) => last_err = Some(format!("{}: {}", cmd, e)),
        }
    }

    Err(format!(
        "Failed to start python worker at {:?} -- tried: {}",
        worker_dir,
        last_err.unwrap_or_else(|| "no candidates".to_string())
    ))
}

#[tauri::command]
pub async fn execute_worker_command(
    app: AppHandle,
    request: WorkerRequestPayload,
) -> Result<WorkerResponsePayload, String> {
    let req_json = serde_json::to_string(&request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    let worker_dir = resolve_worker_dir();

    let mut child = spawn_worker_process(&app, &worker_dir)?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open worker stdin".to_string())?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open worker stdout".to_string())?;

    // Write request line to stdin
    writeln!(stdin, "{}", req_json)
        .map_err(|e| format!("Failed to write to worker stdin: {}", e))?;
    drop(stdin); // Close stdin to signal end of stream for one-shot command

    let reader = BufReader::new(stdout);
    let mut final_response: Option<WorkerResponsePayload> = None;

    for line_result in reader.lines() {
        let line = line_result.map_err(|e| format!("Failed to read worker line: {}", e))?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Ok(parsed) = serde_json::from_str::<WorkerResponsePayload>(trimmed) {
            if parsed.msg_type == "progress" {
                // Emit progress event to frontend
                let _ = app.emit("worker_progress", parsed.clone());
            } else {
                final_response = Some(parsed);
                break;
            }
        }
    }

    let _ = child.wait();

    final_response.ok_or_else(|| "Worker finished without returning a final response".to_string())
}
