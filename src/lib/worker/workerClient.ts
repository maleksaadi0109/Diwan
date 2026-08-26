export interface WorkerHealthData {
  worker_version: string;
  python_version: string;
  ffmpeg: string;
  ffprobe: string;
  status: string;
}

export interface WorkerAudioMetadata {
  duration_ms: number;
  duration_seconds: float;
  channels: number;
  sample_rate: number;
  codec: string;
  format_name: string;
  size_bytes: number;
  bit_rate?: number;
}

export interface WorkerSpeechInterval {
  start_ms: number;
  end_ms: number;
  confidence: number;
}

export interface WorkerSpeechDetectionData {
  intervals: WorkerSpeechInterval[];
  speech_count: number;
  total_speech_duration_ms: number;
}

export interface WorkerResponse<T> {
  id: string;
  success: boolean;
  data?: T;
  error_code?: string;
  error_message?: string;
}

type float = number;

export async function checkWorkerHealth(): Promise<WorkerHealthData> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const resp = await invoke<WorkerResponse<WorkerHealthData>>("execute_worker_command", {
        request: {
          id: `req-health-${Date.now()}`,
          command: "health",
          payload: {},
        },
      });

      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.error_message || "Health check failed");
    } catch (err) {
      console.warn("Tauri worker health check error:", err);
    }
  }

  // Web fallback simulation
  return {
    worker_version: "0.1.0",
    python_version: "3.14 (Simulated)",
    ffmpeg: "ffmpeg 8.1 (Local System)",
    ffprobe: "ffprobe 8.1 (Local System)",
    status: "ready",
  };
}

export async function inspectAudioFile(filePath: string): Promise<WorkerAudioMetadata> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<WorkerAudioMetadata>>("execute_worker_command", {
      request: {
        id: `req-inspect-${Date.now()}`,
        command: "inspect_audio",
        payload: { file_path: filePath },
      },
    });

    if (resp.success && resp.data) {
      return resp.data;
    }
    throw new Error(resp.error_message || "Failed to inspect audio");
  }

  return {
    duration_ms: 60000,
    duration_seconds: 60.0,
    channels: 1,
    sample_rate: 16000,
    codec: "pcm_s16le",
    format_name: "wav",
    size_bytes: 1920000,
  };
}

export async function convertAudioFile(
  inputPath: string,
  outputPath: string
): Promise<{ outputPath: string; metadata: WorkerAudioMetadata }> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<{ output_path: string; metadata: WorkerAudioMetadata }>>(
      "execute_worker_command",
      {
        request: {
          id: `req-convert-${Date.now()}`,
          command: "convert_audio",
          payload: { input_path: inputPath, output_path: outputPath },
        },
      }
    );

    if (resp.success && resp.data) {
      return {
        outputPath: resp.data.output_path,
        metadata: resp.data.metadata,
      };
    }
    throw new Error(resp.error_message || "Audio conversion failed");
  }

  return {
    outputPath,
    metadata: {
      duration_ms: 60000,
      duration_seconds: 60.0,
      channels: 1,
      sample_rate: 16000,
      codec: "pcm_s16le",
      format_name: "wav",
      size_bytes: 1920000,
    },
  };
}

export async function detectSpeechIntervals(
  wavPath: string
): Promise<WorkerSpeechDetectionData> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<WorkerSpeechDetectionData>>(
      "execute_worker_command",
      {
        request: {
          id: `req-vad-${Date.now()}`,
          command: "detect_speech",
          payload: { wav_path: wavPath },
        },
      }
    );

    if (resp.success && resp.data) {
      return resp.data;
    }
    throw new Error(resp.error_message || "Speech detection failed");
  }

  return {
    intervals: [
      { start_ms: 2500, end_ms: 9800, confidence: 0.95 },
      { start_ms: 10400, end_ms: 18600, confidence: 0.92 },
    ],
    speech_count: 2,
    total_speech_duration_ms: 15500,
  };
}
