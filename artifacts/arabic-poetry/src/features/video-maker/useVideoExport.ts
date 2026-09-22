import { useEffect, useState, useRef } from 'react';
import { resolveAudioSrcAsync } from '@/lib/audio/fileManager';

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

  useEffect(() => {
    return () => stopRef.current?.();
  }, []);

  const startExport = async (
    canvas: HTMLCanvasElement, 
    audioPath: string, 
    durationMs: number,
    onPlaybackStatusChange: (isPlaying: boolean) => void,
    defaultName: string
  ) => {
    if (isExporting) return;
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
      
      const canvasStream = canvas.captureStream(30);
      const tracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      stream = new MediaStream(tracks);

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
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

        activeRecorder.start(100);
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
        }, 100);

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
  };
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
