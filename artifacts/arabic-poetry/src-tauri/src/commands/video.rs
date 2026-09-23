use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::path::PathBuf;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Deserialize)]
pub struct VideoExportRequest {
    pub job_id: String,
    pub frames_dir: String,
    pub audio_path: String,
    pub output_path: String,
    pub frame_rate: u32,
    pub frame_count: u32,
}

enum ExportJob {
    Starting,
    Cancelled,
    Running {
        child: Arc<Mutex<std::process::Child>>,
        cancelled: Arc<AtomicBool>,
    },
}

static EXPORT_JOBS: OnceLock<Mutex<HashMap<String, ExportJob>>> = OnceLock::new();

fn export_jobs() -> &'static Mutex<HashMap<String, ExportJob>> {
    EXPORT_JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn safe_existing_file(path: &str, label: &str) -> Result<PathBuf, String> {
    let value = PathBuf::from(path);
    if !value.is_absolute() || !value.is_file() {
        return Err(format!("{} is not an existing absolute file", label));
    }
    Ok(value)
}

#[tauri::command]
pub async fn export_video_with_ffmpeg(
    app: AppHandle,
    request: VideoExportRequest,
) -> Result<(), String> {
    let job_id = request.job_id.clone();
    if job_id.is_empty() || job_id.len() > 80 ||
        !job_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
        return Err("Invalid export job id".into());
    }
    {
        let mut jobs = export_jobs().lock().map_err(|_| "Export job lock failed")?;
        if jobs.contains_key(&job_id) {
            return Err("This video export is already running".into());
        }
        jobs.insert(job_id.clone(), ExportJob::Starting);
    }
    let result = tauri::async_runtime::spawn_blocking(move || export_video_with_ffmpeg_sync(app, request))
        .await
        .map_err(|e| format!("Video export task failed: {e}"));
    export_jobs().lock().map_err(|_| "Export job lock failed")?.remove(&job_id);
    result?
}

fn export_video_with_ffmpeg_sync(
    app: AppHandle,
    request: VideoExportRequest,
) -> Result<(), String> {
    if !(1..=60).contains(&request.frame_rate) {
        return Err("Invalid video frame rate".into());
    }
    if request.job_id.is_empty() || request.job_id.len() > 80 ||
        !request.job_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
        return Err("Invalid export job id".into());
    }
    if request.frame_count == 0 || request.frame_count > 2_160_000 {
        return Err("Invalid video frame count".into());
    }

    let frames_dir = PathBuf::from(&request.frames_dir);
    if !frames_dir.is_absolute() || !frames_dir.is_dir() {
        return Err("Frames directory is not an existing absolute directory".into());
    }
    let temp_root = app.path().app_data_dir().map_err(|e| format!("Could not locate app data directory: {e}"))?;
    let canonical_frames = frames_dir.canonicalize().map_err(|e| format!("Could not inspect frames directory: {e}"))?;
    let canonical_temp = temp_root.canonicalize().map_err(|e| format!("Could not inspect temp directory: {e}"))?;
    if !canonical_frames.starts_with(&canonical_temp) {
        return Err("Frames must be written beneath the application data directory".into());
    }
    let audio = safe_existing_file(&request.audio_path, "Audio file")?;
    let output = PathBuf::from(&request.output_path);
    if !output.is_absolute() {
        return Err("Output path must be absolute".into());
    }
    if !output.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("webm")) {
        return Err("Output file must be a WebM video".into());
    }
    if output.exists() {
        return Err("The selected output file already exists; choose another name".into());
    }
    if let Some(parent) = output.parent() {
        if !parent.is_dir() {
            return Err("Output directory does not exist".into());
        }
    }

    let ffmpeg = if cfg!(target_os = "windows") {
        app.path().resolve("bin/win/ffmpeg.exe", tauri::path::BaseDirectory::Resource)
            .map_err(|e| format!("Could not locate bundled FFmpeg: {e}"))?
    } else {
        PathBuf::from("ffmpeg")
    };
    if !ffmpeg.is_file() && cfg!(target_os = "windows") {
        return Err("Bundled FFmpeg is missing from this installation".into());
    }

    // Every argument is passed directly to Command: user paths never enter a shell.
    let pattern = frames_dir.join("frame-%06d.jpg");
    let temp_output = frames_dir
        .parent()
        .ok_or("Frames directory has no parent")?
        .join("encoded.webm");
    if temp_output.exists() {
        return Err("A temporary video file already exists for this export".into());
    }
    for index in 1..=request.frame_count {
        let frame = frames_dir.join(format!("frame-{index:06}.jpg"));
        let metadata = std::fs::metadata(&frame)
            .map_err(|_| format!("Missing video frame {index}"))?;
        if !metadata.is_file() || metadata.len() == 0 || metadata.len() > 20 * 1024 * 1024 {
            return Err(format!("Invalid video frame {index}"));
        }
    }
    // Hold one registry lock across the cancellation check, spawn and child
    // registration. A cancellation can neither miss a starting process nor
    // wait on a lock held for the entire encoding duration.
    let mut jobs = export_jobs().lock().map_err(|_| "Export job lock failed")?;
    match jobs.get(&request.job_id) {
        Some(ExportJob::Cancelled) => return Err("Video export cancelled".into()),
        Some(ExportJob::Starting) => {}
        _ => return Err("Video export is no longer active".into()),
    }
    let child = Command::new(&ffmpeg)
        .arg("-n").arg("-hide_banner").arg("-loglevel").arg("error")
        .arg("-framerate").arg(request.frame_rate.to_string())
        .arg("-start_number").arg("1")
        .arg("-progress").arg("pipe:1")
        .arg("-i").arg(&pattern)
        .arg("-i").arg(&audio)
        .args(["-map", "0:v:0", "-map", "1:a:0", "-c:v", "libvpx", "-b:v", "4M",
            "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-b:a", "128k",
            "-af", "apad", "-t", &format!("{:.6}", request.frame_count as f64 / request.frame_rate as f64),
            "-f", "webm"])
        .stdout(Stdio::piped())
        .arg(&temp_output)
        .spawn()
        .map_err(|e| format!("Could not start FFmpeg: {e}"))?;
    let child = Arc::new(Mutex::new(child));
    let cancelled = Arc::new(AtomicBool::new(false));
    jobs.insert(request.job_id.clone(), ExportJob::Running {
        child: child.clone(),
        cancelled: cancelled.clone(),
    });
    drop(jobs);
    let stdout = child.lock().map_err(|_| "Export process lock failed")?.stdout.take();
    if let Some(stdout) = stdout {
        for line in BufReader::new(stdout).lines().flatten() {
            if let Some(value) = line.strip_prefix("out_time_ms=") {
                if let Ok(micros) = value.parse::<f64>() {
                    // FFmpeg's out_time_ms field is in microseconds despite its name.
                    let progress = (micros / 1_000_000.0) /
                        (request.frame_count as f64 / request.frame_rate as f64);
                    let _ = app.emit("video-export-progress", serde_json::json!({
                        "job_id": request.job_id,
                        "progress": (0.55 + progress.clamp(0.0, 1.0) * 0.45),
                    }));
                }
            }
        }
    }
    let status = child.lock().map_err(|_| "Export process lock failed")?.wait()
        .map_err(|e| format!("Could not wait for FFmpeg: {e}"))?;
    if !status.success() {
        let _ = std::fs::remove_file(&temp_output);
        return Err(format!("FFmpeg exited with status {status}"));
    }
    if cancelled.load(Ordering::SeqCst) {
        let _ = std::fs::remove_file(&temp_output);
        return Err("Video export cancelled".into());
    }
    // Encode in private app data, then create the chosen destination only on
    // success. Never delete an existing user file if FFmpeg fails or races a
    // second writer to the save path.
    let mut created_output = false;
    let copy_result = (|| -> std::io::Result<()> {
        let mut source = File::open(&temp_output)?;
        let mut destination = OpenOptions::new().write(true).create_new(true).open(&output)?;
        created_output = true;
        std::io::copy(&mut source, &mut destination)?;
        destination.sync_all()
    })();
    let _ = std::fs::remove_file(&temp_output);
    if let Err(error) = copy_result {
        if created_output { let _ = std::fs::remove_file(&output); }
        return Err(format!("Could not save video: {error}"));
    }
    if cancelled.load(Ordering::SeqCst) {
        let _ = std::fs::remove_file(&output);
        return Err("Video export cancelled".into());
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_video_export(job_id: String) -> Result<(), String> {
    let child = {
        let mut jobs = export_jobs().lock().map_err(|_| "Export job lock failed")?;
        match jobs.get_mut(&job_id) {
            Some(job @ ExportJob::Starting) => {
                *job = ExportJob::Cancelled;
                None
            }
            Some(ExportJob::Running { child, cancelled }) => {
                cancelled.store(true, Ordering::SeqCst);
                Some(child.clone())
            }
            _ => None,
        }
    };
    if let Some(child) = child {
        let _ = child.lock().map_err(|_| "Export process lock failed")?.kill();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancellation_is_remembered_before_process_registration() {
        let id = format!("test-pending-{}", std::process::id());
        export_jobs().lock().unwrap().insert(id.clone(), ExportJob::Starting);
        cancel_video_export(id.clone()).unwrap();
        cancel_video_export(id.clone()).unwrap();
        let mut jobs = export_jobs().lock().unwrap();
        assert!(matches!(jobs.get(&id), Some(ExportJob::Cancelled)));
        jobs.remove(&id);
    }
}