export interface WorkerHealthData {
  worker_version: string;
  python_version: string;
  ffmpeg: string;
  ffprobe: string;
  status: string;
}

export interface WorkerAudioMetadata {
  duration_ms: number;
  duration_seconds: number;
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

export interface TimedWord {
  word: string;
  start_ms: number;
  end_ms: number;
  probability: number;
}

export interface TranscriptSegment {
  id: number;
  text: string;
  start_ms: number;
  end_ms: number;
  words: TimedWord[];
  avg_logprob?: number;
  no_speech_prob?: number;
}

export interface TranscriptResult {
  schema_version: string;
  language: string;
  raw_text: string;
  duration_ms: number;
  model_used: string;
  device_used: string;
  segments: TranscriptSegment[];
  words: TimedWord[];
}

export interface WorkerResponse<T> {
  id: string;
  success: boolean;
  data?: T;
  error_code?: string;
  error_message?: string;
}

export interface TranscribeOptions {
  model_size?: "tiny" | "base" | "small" | "medium" | "large-v3";
  device?: "cpu" | "cuda" | "auto";
  compute_type?: "int8" | "float32" | "float16" | "default";
  mock?: boolean;
  /** Reuse one real word-timestamp transcript during forced alignment. */
  transcript?: TranscriptResult;
}

export interface VerseAlignmentItem {
  verse_id: string;
  order_index: number;
  start_ms: number;
  end_ms: number;
  confidence: number;
  status: "auto" | "review" | "reviewed" | "manual";
  first_hemistich_end_ms?: number;
  second_hemistich_start_ms?: number;
}

export interface PoemAlignmentResponse {
  poem_id: string;
  recording_id: string;
  overall_confidence: number;
  alignments: VerseAlignmentItem[];
}

export interface WorkerYouTubeInfoData {
  video_id: string;
  title: string;
  channel: string;
  duration_seconds: number;
  duration_ms: number;
  thumbnail: string;
  description: string;
  webpage_url: string;
  is_available: boolean;
}

export interface WorkerYouTubeDownloadData {
  source_type: string;
  source_url: string;
  job_id: string;
  duration_ms: number;
  duration_seconds: number;
  sample_rate: number;
  channels: number;
  downloaded_at: string;
  raw_format: string;
  raw_audio_path: string;
  playback_audio_path: string;
  processing_audio_path: string;
  /** Leading intro/silence removed from both synchronized output files. */
  leading_silence_removed_ms?: number;
}

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

export async function transcribeArabicAudio(
  audioPath: string,
  outputJsonPath?: string,
  options: TranscribeOptions = {}
): Promise<{ transcript: TranscriptResult; outputJsonPath?: string }> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<{ transcript: TranscriptResult; output_json_path?: string }>>(
      "execute_worker_command",
      {
        request: {
          id: `req-transcribe-${Date.now()}`,
          command: "transcribe",
          payload: {
            audio_path: audioPath,
            model_size: options.model_size || "small",
            device: options.device || "cpu",
            compute_type: options.compute_type || "default",
            output_json_path: outputJsonPath,
            mock: options.mock || false,
          },
        },
      }
    );

    if (resp.success && resp.data) {
      return {
        transcript: resp.data.transcript,
        outputJsonPath: resp.data.output_json_path,
      };
    }
    throw new Error(resp.error_message || "Arabic transcription failed");
  }

  const response = await fetch("/api-worker/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_path: audioPath,
      output_json_path: outputJsonPath,
      model_size: options.model_size || "small",
      device: options.device || "cpu",
      compute_type: options.compute_type || "default",
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.transcript) {
    throw new Error(body.error_message || "فشل تفريغ الصوت العربي");
  }
  return body as { transcript: TranscriptResult; outputJsonPath?: string };
}

export async function alignPoemAudio(
  audioPath: string,
  verses: Array<{ id: string; orderIndex: number; text: string; firstHemistich?: string; secondHemistich?: string }>,
  poemId: string = "poem",
  recordingId: string = "rec",
  options: TranscribeOptions = {}
): Promise<PoemAlignmentResponse> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<PoemAlignmentResponse>>(
      "execute_worker_command",
      {
        request: {
          id: `req-align-${Date.now()}`,
          command: "align",
          payload: {
            audio_path: audioPath,
            verses: verses.map((v) => ({
              id: v.id,
              order_index: v.orderIndex,
              text: v.text,
              first_hemistich: v.firstHemistich,
              second_hemistich: v.secondHemistich,
            })),
            poem_id: poemId,
            recording_id: recordingId,
            transcript: options.transcript,
            mock: options.mock || false,
          },
        },
      }
    );

    if (resp.success && resp.data) {
      return resp.data;
    }
    throw new Error(resp.error_message || "Poem alignment failed");
  }

  const response = await fetch("/api-worker/align", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_path: audioPath,
      verses: verses.map((v) => ({
        id: v.id,
        order_index: v.orderIndex,
        text: v.text,
        first_hemistich: v.firstHemistich,
        second_hemistich: v.secondHemistich,
      })),
      poem_id: poemId,
      recording_id: recordingId,
      transcript: options.transcript,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(body.alignments)) {
    throw new Error(body.error_message || "فشل محاذاة القصيدة مع الصوت");
  }
  return body as PoemAlignmentResponse;
}

// --- YouTube Audio Integration ---

export async function fetchYoutubeVideoInfo(
  url: string,
  maxDurationSeconds: number = 3600
): Promise<WorkerYouTubeInfoData> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<WorkerYouTubeInfoData>>("execute_worker_command", {
      request: {
        id: `req-yt-info-${Date.now()}`,
        command: "youtube_info",
        payload: { url, max_duration_seconds: maxDurationSeconds },
      },
    });

    if (resp.success && resp.data) {
      return resp.data;
    }
    throw new Error(resp.error_message || "تعذر جلب بيانات مقطع YouTube");
  }

  const response = await fetch("/api-worker/youtube/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      max_duration_seconds: maxDurationSeconds,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.video_id) {
    throw new Error(body.error_message || "تعذر جلب بيانات مقطع YouTube");
  }
  return body as WorkerYouTubeInfoData;
}

export async function downloadYoutubeAudio(
  url: string,
  outputDir: string = "recordings",
  quality: "128k" | "192k" = "192k",
  jobId?: string
): Promise<WorkerYouTubeDownloadData> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<WorkerYouTubeDownloadData>>("execute_worker_command", {
      request: {
        id: `req-yt-down-${Date.now()}`,
        command: "youtube_download",
        payload: { url, output_dir: outputDir, quality, job_id: jobId },
      },
    });

    if (resp.success && resp.data) {
      return resp.data;
    }
    throw new Error(resp.error_message || "فشل تنزيل المقطع الصوتي من YouTube");
  }

  const response = await fetch("/api-worker/youtube/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      quality,
      job_id: jobId,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.playback_audio_path) {
    throw new Error(body.error_message || "فشل تنزيل المقطع الصوتي من YouTube");
  }
  return body as WorkerYouTubeDownloadData;
}

export async function cancelYoutubeDownload(jobId: string, jobDir?: string): Promise<boolean> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const resp = await invoke<WorkerResponse<{ cancelled: boolean }>>("execute_worker_command", {
      request: {
        id: `req-yt-cancel-${Date.now()}`,
        command: "youtube_cancel",
        payload: { job_id: jobId, job_dir: jobDir },
      },
    });
    return resp.data?.cancelled ?? true;
  }

  const response = await fetch("/api-worker/youtube/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  const body = await response.json().catch(() => ({}));
  return response.ok && body.cancelled === true;
}

// --- Universal HTTP Fetcher (Bypasses Browser CORS via Python Worker / Proxy) ---

export interface WorkerFetchUrlData {
  status: number;
  content_type: string;
  text: string;
}

export async function fetchUrlViaWorker(
  url: string,
  headers?: Record<string, string>
): Promise<WorkerFetchUrlData> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const resp = await invoke<WorkerResponse<WorkerFetchUrlData>>("execute_worker_command", {
        request: {
          id: `req-fetch-${Date.now()}`,
          command: "fetch_url",
          payload: { url, headers },
        },
      });

      if (resp.success && resp.data) {
        return resp.data;
      }
      throw new Error(resp.error_message || `فشل الاتصال بالرابط: ${url}`);
    } catch (tauriErr) {
      console.warn("Tauri worker fetch failed, trying proxy/fallback:", tauriErr);
    }
  }

  // Web Browser / Proxy mode: rewrite to local vite proxy if mizanalarab.com
  let targetUrl = url;
  if (url.startsWith("https://mizanalarab.com")) {
    targetUrl = url.replace("https://mizanalarab.com", "/api-mizan");
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        ...headers,
      },
    });

    const text = await response.text();
    return {
      status: response.status,
      content_type: response.headers.get("content-type") || "",
      text,
    };
  } catch (browserFetchErr) {
    // If standard fetch was blocked by CORS and we are not using proxy, try proxy
    if (targetUrl === url && url.startsWith("https://mizanalarab.com")) {
      const proxyUrl = url.replace("https://mizanalarab.com", "/api-mizan");
      const proxyResp = await fetch(proxyUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...headers,
        },
      });
      const text = await proxyResp.text();
      return {
        status: proxyResp.status,
        content_type: proxyResp.headers.get("content-type") || "",
        text,
      };
    }
    throw browserFetchErr;
  }
}

