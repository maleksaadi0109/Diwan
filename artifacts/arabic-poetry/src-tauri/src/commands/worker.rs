use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

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

#[tauri::command]
pub async fn execute_worker_command(
    app: AppHandle,
    request: WorkerRequestPayload,
) -> Result<WorkerResponsePayload, String> {
    let req_json = serde_json::to_string(&request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    let worker_dir = resolve_worker_dir();

    // Spawn python worker process with resolved PYTHONPATH
    let mut child = Command::new("python3")
        .args(["-m", "diwan_worker.cli"])
        .env("PYTHONPATH", &worker_dir)
        .current_dir(&worker_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to start python worker at {:?}: {}",
                worker_dir, e
            )
        })?;

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
