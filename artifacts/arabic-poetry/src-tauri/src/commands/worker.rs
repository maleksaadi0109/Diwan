use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use tauri::{path::BaseDirectory, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(target_os = "windows")]
fn hide_console_window(command: &mut Command) {
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn hide_console_window(_command: &mut Command) {}

#[cfg(target_os = "windows")]
fn clean_windows_path(path: &std::path::Path) -> PathBuf {
    // Tauri may return extended-length paths such as \\?\C:\... . Python
    // and some bundled tools do not accept that prefix consistently, so pass
    // them a normal Windows path when possible.
    let value = path.to_string_lossy();
    value
        .strip_prefix("\\\\?\\")
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

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

    // 2. User home and XDG data dirs
    if let Ok(home) = std::env::var("HOME") {
        let home_path = PathBuf::from(&home);
        let p1 = home_path.join(".local/share/diwan/worker");
        if p1.join("diwan_worker").exists() {
            return p1;
        }
        let p2 = home_path.join(".diwan/worker");
        if p2.join("diwan_worker").exists() {
            return p2;
        }
    }
    if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
        let p = PathBuf::from(xdg).join("diwan").join("worker");
        if p.join("diwan_worker").exists() {
            return p;
        }
    }

    // 4. Built-in compile-time relative path from cargo manifest dir
    let compile_time_candidates = [
        concat!(env!("CARGO_MANIFEST_DIR"), "/../worker"),
        concat!(env!("CARGO_MANIFEST_DIR"), "/../../worker"),
        concat!(env!("CARGO_MANIFEST_DIR"), "/artifacts/arabic-poetry/worker"),
    ];
    for cand in &compile_time_candidates {
        let p = PathBuf::from(cand);
        if p.join("diwan_worker").exists() {
            return p;
        }
    }

    // 5. Relative paths from current working directory
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

    // 6. Search relative to current executable
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

/// Candidate Python launcher commands, tried in order.
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

#[cfg(target_os = "windows")]
fn resolve_bundled_bin(app: &AppHandle, filename: &str) -> Option<PathBuf> {
    app.path()
        .resolve(format!("bin/win/{}", filename), BaseDirectory::Resource)
        .ok()
        .filter(|p| p.exists())
        .map(|p| clean_windows_path(&p))
}

#[cfg(not(target_os = "windows"))]
fn resolve_bundled_bin(_app: &AppHandle, _filename: &str) -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
fn resolve_bundled_models_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resolve("models", BaseDirectory::Resource)
        .ok()
        .filter(|p| p.exists())
        .map(|p| clean_windows_path(&p))
}

#[cfg(not(target_os = "windows"))]
fn resolve_bundled_models_dir(_app: &AppHandle) -> Option<PathBuf> {
    None
}

fn spawn_worker_process(app: &AppHandle, worker_dir: &PathBuf) -> Result<std::process::Child, String> {
    let ffmpeg_path = resolve_bundled_bin(app, "ffmpeg.exe");
    let ffprobe_path = resolve_bundled_bin(app, "ffprobe.exe");
    let models_dir = resolve_bundled_models_dir(app);

    if let Some(frozen_exe) = resolve_frozen_worker_exe(app) {
        let mut command = Command::new(&frozen_exe);
        hide_console_window(&mut command);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .env("PYTHONIOENCODING", "utf-8:backslashreplace")
            .env("PYTHONUTF8", "1")
            .stderr(Stdio::piped());
        if let Some(p) = &ffmpeg_path {
            command.env("DIWAN_FFMPEG_PATH", p);
        }
        if let Some(p) = &ffprobe_path {
            command.env("DIWAN_FFPROBE_PATH", p);
        }
        if let Some(m) = &models_dir {
            command.env("DIWAN_MODELS_DIR", m);
            command.env("DIWAN_BUNDLED_MODELS_DIR", m);
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
        hide_console_window(&mut command);
        command
            .args(&args)
            .env("PYTHONPATH", worker_dir)
            .current_dir(worker_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .env("PYTHONIOENCODING", "utf-8:backslashreplace")
            .env("PYTHONUTF8", "1")
            .stderr(Stdio::piped());
        if let Some(p) = &ffmpeg_path {
            command.env("DIWAN_FFMPEG_PATH", p);
        }
        if let Some(p) = &ffprobe_path {
            command.env("DIWAN_FFPROBE_PATH", p);
        }
        if let Some(m) = &models_dir {
            command.env("DIWAN_MODELS_DIR", m);
            command.env("DIWAN_BUNDLED_MODELS_DIR", m);
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

// Drain stderr while stdout is being read. A frozen worker can write enough
// diagnostics to fill the pipe; leaving it unread can block the worker before
// it has a chance to send its JSON response.
fn collect_worker_stderr(stderr: impl Read + Send + 'static) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut chunk = [0_u8; 4096];
        let mut tail = Vec::new();
        loop {
            match reader.read(&mut chunk) {
                Ok(0) => break,
                Ok(n) => {
                    tail.extend_from_slice(&chunk[..n]);
                    if tail.len() > 16_384 {
                        tail.drain(..tail.len() - 16_384);
                    }
                }
                Err(_) => break,
            }
        }
        String::from_utf8_lossy(&tail).trim().to_string()
    })
}

/// Fast native HTTP fetch using system curl for instant reliability
fn fetch_url_native(req_id: &str, url: &str, headers: Option<&serde_json::Value>) -> Result<WorkerResponsePayload, String> {
    let mut cmd = Command::new("curl");
    hide_console_window(&mut cmd);
    cmd.args([
        "-s",
        "-S",
        "-L",
        "-i",
        "--max-time",
        "30",
        "-A",
        "DiwanDesktop/1.0 (Arabic Poetic Audio Sync; +https://github.com/diwan/diwan)",
    ]);

    if let Some(h) = headers.and_then(|v| v.as_object()) {
        for (k, v) in h {
            if let Some(s) = v.as_str() {
                cmd.arg("-H").arg(format!("{}: {}", k, s));
            }
        }
    }
    cmd.arg(url);

    let output = cmd.output().map_err(|e| format!("Failed to execute curl: {}", e))?;
    let raw = String::from_utf8_lossy(&output.stdout);

    // Parse HTTP headers and body from curl -i
    let (header_part, body) = if let Some(pos) = raw.rfind("\r\n\r\n") {
        (&raw[..pos], &raw[pos + 4..])
    } else if let Some(pos) = raw.rfind("\n\n") {
        (&raw[..pos], &raw[pos + 2..])
    } else {
        ("", raw.as_ref())
    };

    let status = header_part
        .lines()
        .filter(|l| l.starts_with("HTTP/"))
        .last()
        .and_then(|line| {
            line.split_whitespace()
                .nth(1)
                .and_then(|s| s.parse::<u16>().ok())
        })
        .unwrap_or(if output.status.success() { 200 } else { 500 });

    let content_type = header_part
        .lines()
        .find(|l| l.to_lowercase().starts_with("content-type:"))
        .map(|l| l.split(':').nth(1).unwrap_or("").trim().to_string())
        .unwrap_or_else(|| "application/json".to_string());

    Ok(WorkerResponsePayload {
        msg_type: "response".to_string(),
        id: req_id.to_string(),
        success: status >= 200 && status < 300,
        data: Some(serde_json::json!({
            "status": status,
            "content_type": content_type,
            "text": body,
        })),
        error_code: if status >= 200 && status < 300 {
            None
        } else {
            Some("HTTP_ERROR".to_string())
        },
        error_message: if status >= 200 && status < 300 {
            None
        } else {
            Some(format!("HTTP error {}", status))
        },
        stage: None,
        progress: None,
    })
}

#[tauri::command]
pub async fn execute_worker_command(
    app: AppHandle,
    request: WorkerRequestPayload,
) -> Result<WorkerResponsePayload, String> {
    // Fast path: fetch_url can run via native system curl without needing Python
    if request.command == "fetch_url" {
        if let Some(url) = request.payload.get("url").and_then(|v| v.as_str()) {
            let headers = request.payload.get("headers");
            if let Ok(native_resp) = fetch_url_native(&request.id, url, headers) {
                return Ok(native_resp);
            }
        }
    }

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
    let stderr_reader = child.stderr.take().map(collect_worker_stderr);

    // Write request line to stdin
    writeln!(stdin, "{}", req_json)
        .map_err(|e| format!("Failed to write to worker stdin: {}", e))?;
    drop(stdin); // Close stdin to signal end of stream for one-shot command

    let reader = BufReader::new(stdout);
    let mut final_response: Option<WorkerResponsePayload> = None;
    let mut unexpected_stdout = None;

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
        } else if unexpected_stdout.is_none() {
            unexpected_stdout = Some(trimmed.chars().take(500).collect::<String>());
        }
    }

    if let Some(response) = final_response {
        // Do not delay a successful response waiting for Python's ML threads
        // to exit. The background reaper also closes the stderr reader.
        std::thread::spawn(move || {
            let _ = child.wait();
            if let Some(reader) = stderr_reader {
                let _ = reader.join();
            }
        });
        return Ok(response);
    }

    let status = child.wait().map_err(|e| format!("Failed to wait for worker: {e}"))?;
    let stderr = stderr_reader
        .and_then(|reader| reader.join().ok())
        .unwrap_or_default();
    let mut details = format!("Worker exited ({status}) without returning a final response");
    if !stderr.is_empty() {
        details.push_str(&format!("; stderr: {stderr}"));
    }
    if let Some(stdout) = unexpected_stdout {
        details.push_str(&format!("; unexpected stdout: {stdout}"));
    }
    Err(details)
}
