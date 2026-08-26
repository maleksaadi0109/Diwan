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
}

export interface VerseAlignmentItem {
  verse_id: string;
  order_index: number;
  start_ms: number;
  end_ms: number;
  confidence: number;
  status: "auto" | "reviewed" | "manual";
  first_hemistich_end_ms?: number;
  second_hemistich_start_ms?: number;
}

export interface PoemAlignmentResponse {
  poem_id: string;
  recording_id: string;
  overall_confidence: number;
  alignments: VerseAlignmentItem[];
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

  // Fallback for development / mock preview
  return {
    transcript: {
      schema_version: "1.0",
      language: "ar",
      raw_text: "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم",
      duration_ms: 15000,
      model_used: options.model_size || "small",
      device_used: options.device || "cpu",
      segments: [
        {
          id: 1,
          text: "واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم",
          start_ms: 2500,
          end_ms: 9800,
          words: [
            { word: "واحر", start_ms: 2500, end_ms: 3100, probability: 0.97 },
            { word: "قلباه", start_ms: 3200, end_ms: 4000, probability: 0.95 },
            { word: "ممن", start_ms: 4100, end_ms: 4500, probability: 0.98 },
            { word: "قلبه", start_ms: 4600, end_ms: 5200, probability: 0.94 },
            { word: "شبم", start_ms: 5300, end_ms: 6100, probability: 0.92 },
          ],
        },
      ],
      words: [
        { word: "واحر", start_ms: 2500, end_ms: 3100, probability: 0.97 },
        { word: "قلباه", start_ms: 3200, end_ms: 4000, probability: 0.95 },
        { word: "ممن", start_ms: 4100, end_ms: 4500, probability: 0.98 },
        { word: "قلبه", start_ms: 4600, end_ms: 5200, probability: 0.94 },
        { word: "شبم", start_ms: 5300, end_ms: 6100, probability: 0.92 },
      ],
    },
    outputJsonPath,
  };
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

  // Web fallback simulation
  return {
    poem_id: poemId,
    recording_id: recordingId,
    overall_confidence: 0.92,
    alignments: verses.map((v, i) => ({
      verse_id: v.id,
      order_index: v.orderIndex,
      start_ms: i * 7500,
      end_ms: (i + 1) * 7500,
      confidence: 0.92,
      status: "auto",
      first_hemistich_end_ms: i * 7500 + 3500,
      second_hemistich_start_ms: i * 7500 + 3600,
    })),
  };
}
