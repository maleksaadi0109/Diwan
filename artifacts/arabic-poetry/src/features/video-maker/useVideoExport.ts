import { useEffect, useState, useRef } from 'react';
import { resolveAudioSrcAsync } from '@/lib/audio/fileManager';
import { getVideoExportProfile } from './videoExportProfile';
import { renderVideoFrame } from './useVideoRenderer';

type SaveResult =
  | { status: "saved" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const exportTimeMsRef = useRef<number | null>(null);
  const renderAtRef = useRef<((timeMs: number) => void) | null>(null);

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  const startExport = async (
    canvas: HTMLCanvasElement, 
    audioPath: string, 
    durationMs: number,
    renderAtRef: React.MutableRefObject<((timeMs: number) => void) | null>,
    onPlaybackStatusChange: (isPlaying: boolean) => void,
    defaultName: string
  ) => {
    if (isExporting) return;
    const isTauri = typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
    if (isTauri) {
      await startDesktopExport(
        canvas,
        audioPath,
        durationMs,
        defaultName,
        setIsExporting,
        setProgress,
        setExportError,
        setExportMessage,
        exportTimeMsRef,
        stopRef,
        renderAtRef,
      );
      return;
    }
    const profile = getVideoExportProfile();
    setExportError(null);
    setExportMessage(null);

    if (
      typeof MediaRecorder === "undefined" ||
      typeof MediaStream === "undefined" ||
      typeof canvas.captureStream !== "function"
    ) {
      setExportError("هذا الجهاز لا يدعم تسجيل الفيديو من المعاينة.");
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!AudioContextCtor) {
      setExportError("هذا الجهاز لا يدعم دمج الصوت مع الفيديو.");
      return;
    }

    setIsExporting(true);
    setProgress(0);

    let audio: HTMLAudioElement | null = null;
    let audioCtx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    let cleaned = false;
    let audioEndedAt: number | null = null;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (interval) clearInterval(interval);
      audio?.pause();
      stream?.getTracks().forEach((track) => track.stop());
      if (audioCtx && audioCtx.state !== "closed") void audioCtx.close();
      exportTimeMsRef.current = null;
      stopRef.current = null;
      setIsExporting(false);
      onPlaybackStatusChange(false);
    };

    stopRef.current = () => {
      cancelled = true;
      setExportMessage("تم إلغاء التصدير.");
      if (recorder?.state !== "inactive") {
        recorder?.stop();
      } else {
        cleanup();
      }
    };

    try {
      const audioSrc = await resolveAudioSrcAsync(audioPath);
      if (cancelled) {
        cleanup();
        return;
      }
      const loadedAudio = new Audio(audioSrc);
      audio = loadedAudio;
      loadedAudio.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("audio-timeout")), 15_000);
        loadedAudio.oncanplay = () => {
          clearTimeout(timeout);
          resolve();
        };
        loadedAudio.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("audio-load-failed"));
        };
        loadedAudio.load();
      });
      if (cancelled) {
        cleanup();
        return;
      }

      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }
      if (cancelled) {
        cleanup();
        return;
      }

      audioCtx = new AudioContextCtor();
      await audioCtx.resume();
      if (cancelled) {
        cleanup();
        return;
      }
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createMediaElementSource(loadedAudio);
      
      source.connect(dest);
      source.connect(audioCtx.destination);
      
      const canvasStream = canvas.captureStream(profile.frameRate);
      const tracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      stream = new MediaStream(tracks);

      const mimeType = profile.mimeTypes.find(
        mime => MediaRecorder.isTypeSupported(mime)
      );
      if (!mimeType) throw new Error("unsupported-codec");

      const activeRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
      recorder = activeRecorder;
      const chunks: Blob[] = [];

      activeRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      await new Promise<void>((resolve, reject) => {
        activeRecorder.onstop = async () => {
          try {
            if (!cancelled) {
              const blob = new Blob(chunks, { type: mimeType });
              if (blob.size === 0) throw new Error("empty-video");
              const result = await saveVideoBlob(blob, sanitizeVideoName(defaultName));
              if (result.status === "saved") {
                setExportMessage("تم إنشاء ملف الفيديو وتنزيله.");
              } else if (result.status === "cancelled") {
                setExportMessage("تم إلغاء اختيار مكان الحفظ.");
              } else {
                setExportError(`تعذر حفظ الفيديو: ${result.message}`);
              }
            }
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            cleanup();
          }
        };

        activeRecorder.onerror = () => reject(new Error("media-recorder-error"));

        activeRecorder.start(profile.chunkIntervalMs);
        onPlaybackStatusChange(true);
        loadedAudio.currentTime = 0;
        exportTimeMsRef.current = 0;
        loadedAudio.play().then(() => {
          if (cancelled) loadedAudio.pause();
        }).catch(reject);

        interval = setInterval(() => {
          if (cancelled) return;
          if (loadedAudio.ended && audioEndedAt === null) {
            audioEndedAt = performance.now();
          }

          const mediaTimeMs = loadedAudio.currentTime * 1000;
          const outroElapsedMs = audioEndedAt === null ? 0 : performance.now() - audioEndedAt;
          const timelineTimeMs = Math.min(durationMs, mediaTimeMs + outroElapsedMs);
          exportTimeMsRef.current = timelineTimeMs;
          setProgress(Math.min(1, timelineTimeMs / durationMs));
          
          if (timelineTimeMs >= durationMs) {
            if (interval) clearInterval(interval);
            if (recorder?.state !== 'inactive') recorder?.stop();
          }
        }, profile.progressIntervalMs);

        stopRef.current = () => {
          cancelled = true;
          setExportMessage("تم إلغاء التصدير.");
          if (interval) clearInterval(interval);
          if (recorder?.state !== 'inactive') {
            recorder?.stop();
          } else {
            cleanup();
            resolve();
          }
        };
      });

    } catch (err) {
      console.error("Export failed", err);
      cancelled = true;
      if (recorder?.state !== "inactive") recorder?.stop();
      cleanup();
      const message = err instanceof Error ? err.message : "";
      setExportError(
        message === "unsupported-codec"
          ? "لا يوجد ترميز WebM مدعوم على هذا الجهاز."
          : message === "audio-load-failed" || message === "audio-timeout"
            ? "تعذر تجهيز التسجيل الصوتي للتصدير."
            : "فشل تصدير الفيديو. تحقق من التسجيل وحاول مرة أخرى."
      );
    }
  };

  const cancelExport = () => {
    stopRef.current?.();
  };

  return {
    isExporting,
    progress,
    exportError,
    exportMessage,
    startExport,
    cancelExport,
    exportTimeMsRef,
    renderAtRef,
  };
}

async function startDesktopExport(
  canvas: HTMLCanvasElement,
  audioPath: string,
  durationMs: number,
  defaultName: string,
  setIsExporting: (value: boolean) => void,
  setProgress: (value: number) => void,
  setExportError: (value: string | null) => void,
  setExportMessage: (value: string | null) => void,
  exportTimeMsRef: React.MutableRefObject<number | null>,
  stopRef: React.MutableRefObject<(() => void) | null>,
  renderAtRef: React.MutableRefObject<((timeMs: number) => void) | null>,
) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 24 * 60 * 60 * 1000) {
    setExportError("مدة الفيديو غير صالحة.");
    return;
  }
  const frameRate = 24;
  const frameCount = Math.ceil((durationMs / 1000) * frameRate);
  if (frameCount < 1 || frameCount > 2_160_000) {
    setExportError("مدة الفيديو أكبر من الحد المسموح.");
    return;
  }

  let cancelled = false;
  let nativeStarted = false;
  const jobId = `video-export-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let cleanup: (() => Promise<void>) | null = null;
  let stopProgressListener: (() => void) | null = null;
  setIsExporting(true);
  setProgress(0);
  setExportError(null);
  setExportMessage(null);
  stopRef.current = () => {
    cancelled = true;
    setExportMessage("تم إلغاء التصدير.");
    if (nativeStarted) {
      void import("@tauri-apps/api/core").then(({ invoke }) =>
        invoke("cancel_video_export", { jobId }).catch(() => undefined),
      );
    }
  };

  try {
    const [{ save }, { appDataDir, join }, { exists, mkdir, remove, writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/api/path"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const targetPath = await save({
      defaultPath: sanitizeVideoName(defaultName),
      filters: [{ name: "فيديو WebM", extensions: ["webm"] }],
    });
    if (!targetPath) {
      setExportMessage("تم إلغاء اختيار مكان الحفظ.");
      return;
    }
    if (cancelled) return;
    if (!targetPath.toLowerCase().endsWith(".webm")) {
      throw new Error("يجب اختيار اسم ملف WebM.");
    }

    const root = await appDataDir();
    const exportDir = await join(root, `diwan-video-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const framesDir = await join(exportDir, "frames");
    const audioFile = await join(exportDir, "audio.bin");
    await mkdir(framesDir, { recursive: true });
    cleanup = async () => {
      try { await remove(exportDir, { recursive: true }); } catch { /* best effort cleanup */ }
    };

    // Blob URLs (microphone recordings) do not exist on the native side. Copy
    // them once to temp storage; local absolute paths are passed through.
    let nativeAudioPath = await stageDesktopAudio(
      audioPath, audioFile, exists, writeFile,
    );

    for (let index = 0; index < frameCount; index += 1) {
      if (cancelled) return;
      const timestamp = Math.min(durationMs, (index * 1000) / frameRate);
      renderVideoFrame(renderAtRef, timestamp);
      const blob = await canvasToJpeg(canvas);
      if (blob.size === 0 || blob.size > 20 * 1024 * 1024) {
        throw new Error("تعذر إنشاء إطار فيديو صالح.");
      }
      await writeFile(
        await join(framesDir, `frame-${String(index + 1).padStart(6, "0")}.jpg`),
        new Uint8Array(await blob.arrayBuffer()),
      );
      setProgress(0.55 * ((index + 1) / frameCount));
    }
    if (cancelled) return;

    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");
    stopProgressListener = await listen<{ job_id: string; progress: number }>(
      "video-export-progress",
      (event) => {
        if (event.payload.job_id === jobId) setProgress(Math.max(0.55, Math.min(0.99, event.payload.progress)));
      },
    );
    if (cancelled) return;
    nativeStarted = true;
    await invoke("export_video_with_ffmpeg", {
      request: {
        job_id: jobId,
        frames_dir: framesDir,
        audio_path: nativeAudioPath,
        output_path: targetPath,
        frame_rate: frameRate,
        frame_count: frameCount,
      },
    });
    if (cancelled) return;
    setProgress(1);
    setExportMessage("تم إنشاء ملف الفيديو وحفظه.");
  } catch (error) {
    if (!cancelled) {
      setExportError(error instanceof Error ? error.message : "فشل تصدير الفيديو.");
    }
  } finally {
    exportTimeMsRef.current = null;
    renderAtRef.current?.(-1);
    stopProgressListener?.();
    stopRef.current = null;
    if (cleanup) await cleanup();
    setIsExporting(false);
  }
}

const MAX_STAGED_AUDIO_BYTES = 250 * 1024 * 1024;

export async function stageDesktopAudio(
  audioPath: string,
  targetPath: string,
  exists: (path: string) => Promise<boolean>,
  writeFile: (path: string, data: Uint8Array) => Promise<void>,
): Promise<string> {
  const isWindowsPath = /^[A-Za-z]:[\\/]|^\\\\/.test(audioPath);
  if (isWindowsPath || audioPath.startsWith("/")) {
    try {
      if (await exists(audioPath)) return audioPath;
    } catch {
      // Fall through to the resolved source; inaccessible paths must not be
      // handed to FFmpeg as if they were valid.
    }
  }
  if (isWindowsPath) {
    throw new Error("تعذر الوصول إلى ملف التسجيل الصوتي على هذا الجهاز.");
  }

  // A leading slash is an app URL on Windows (e.g. /recordings/voice.mp3),
  // not a native filesystem path. The playback resolver treats it as a file.
  const source = audioPath.startsWith("/") ? audioPath : await resolveAudioSrcAsync(audioPath).catch(() => {
    throw new Error("تعذر العثور على التسجيل الصوتي.");
  });
  let parsed: URL;
  try {
    parsed = new URL(source, window.location.href);
  } catch {
    throw new Error("مسار التسجيل الصوتي غير صالح.");
  }
  if ((parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin !== window.location.origin) {
    throw new Error("لا يمكن استخدام تسجيل صوتي من مصدر خارجي.");
  }
  const response = await fetch(parsed.href);
  if (!response.ok) throw new Error("تعذر تحميل التسجيل الصوتي.");
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_STAGED_AUDIO_BYTES || contentType.includes("text/html")) {
    throw new Error("ملف التسجيل الصوتي غير صالح أو كبير جداً.");
  }
  const bytes = await readBoundedAudio(response);
  if (bytes.length === 0 || bytes.length > MAX_STAGED_AUDIO_BYTES) {
    throw new Error("ملف التسجيل الصوتي غير صالح أو كبير جداً.");
  }
  const prefix = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart().toLowerCase();
  if (prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.startsWith("<head")) {
    throw new Error("مصدر التسجيل الصوتي أعاد صفحة HTML وليس ملفاً صوتياً.");
  }
  if (contentType && !contentType.startsWith("audio/") &&
      !contentType.includes("octet-stream") && !contentType.includes("binary")) {
    throw new Error("نوع ملف التسجيل الصوتي غير مدعوم.");
  }
  await writeFile(targetPath, bytes);
  return targetPath;
}

async function readBoundedAudio(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_STAGED_AUDIO_BYTES) {
        await reader.cancel();
        throw new Error("ملف التسجيل الصوتي غير صالح أو كبير جداً.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("تعذر إنشاء صورة الإطار.")), "image/jpeg", 0.9);
  });
}

async function saveVideoBlob(blob: Blob, defaultName: string): Promise<SaveResult> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  
  if (isTauri) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const targetPath = await save({
        defaultPath: defaultName,
        filters: [{ name: "فيديو WebM", extensions: ["webm"] }],
      });
      
      if (targetPath) {
        await writeFile(targetPath, bytes);
        return { status: "saved" };
      }
      return { status: "cancelled" };
    } catch (e) {
      console.error("Tauri save failed", e);
      return {
        status: "error",
        message: e instanceof Error ? e.message : "خطأ غير معروف",
      };
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { status: "saved" };
  }
}

function sanitizeVideoName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${cleaned || "فيديو قصيدة"}.webm`;
}
