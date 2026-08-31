import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Bahr, Era, ImportJob, Poem } from "@/types";
import { DiwanRepository } from "@/lib/db/repository";
import { normalizeArabic } from "@/lib/utils";
import { getPoemRecordingDirectory, copyAudioToAppData } from "@/lib/audio/fileManager";
import {
  fetchYoutubeVideoInfo,
  downloadYoutubeAudio,
  downloadYoutubeThumbnail,
  cancelYoutubeDownload,
  convertAudioFile,
  inspectAudioFile,
  detectSpeechIntervals,
  transcribeArabicAudio,
  alignPoemAudio,
  WorkerYouTubeInfoData,
  WorkerYouTubeDownloadData,
} from "@/lib/worker/workerClient";
import type { ParsedVersePayload } from "@/lib/providers/types";

// --- Job payload/result shapes -------------------------------------------------

export interface PoemImportJobPayload {
  title: string;
  poetName: string;
  era: Era;
  bahr: Bahr;
  rhyme: string;
  parsedVerses: ParsedVersePayload[];
  audioSourceMode: "youtube" | "local" | "skip";
  youtubeUrl?: string;
  youtubeCookies?: string;
  youtubeInfo?: WorkerYouTubeInfoData | null;
  youtubeCoverImage?: string | null;
  localAudioPath?: string;
  localAudioName?: string;
  importedFromMizan?: boolean;
  mizanPoemId?: string | null;
  mizanUrl?: string;
}

export interface PoemImportJobResult {
  poemId: string;
  poemTitle: string;
}

export interface YoutubeDownloadJobPayload {
  url: string;
  quality: "128k" | "192k";
  cookies?: string;
  videoInfo: WorkerYouTubeInfoData;
}

export interface YoutubeDownloadJobResult {
  download: WorkerYouTubeDownloadData;
  videoInfo: WorkerYouTubeInfoData;
}

// --- Error mapping (shared with the wizard/YouTube views) ---------------------

const ERROR_MAP: Record<string, string> = {
  YTDLP_NOT_INSTALLED: "مكوّن تنزيل YouTube غير مثبت.",
  FFMPEG_NOT_FOUND: "برنامج FFmpeg غير متوفر أو لم يتم العثور على مساره.",
  VIDEO_UNAVAILABLE: "المقطع غير متاح أو تم حذفه.",
  PRIVATE_VIDEO: "المقطع خاص ولا يمكن تنزيله.",
  LOGIN_REQUIRED: "يتطلب هذا المقطع تسجيل الدخول. أعد المحاولة من المعالج مع كوكيز صالحة.",
  COOKIES_INVALID: "بيانات تسجيل الدخول (الكوكيز) غير صالحة أو منتهية الصلاحية.",
  LIVE_STREAM_NOT_SUPPORTED: "تنزيل البث المباشر غير مدعوم.",
  NO_AUDIO_FORMAT: "لم يتم العثور على مسار صوتي مناسب.",
  DOWNLOAD_FAILED: "فشل تنزيل الصوت.",
  CONVERSION_FAILED: "تم تنزيل الملف، لكن تحويله إلى MP3 فشل.",
  OUTPUT_MISSING: "انتهت عملية التنزيل دون إنشاء ملف صوتي.",
  NETWORK_TIMEOUT: "انتهت مهلة الاتصال أثناء تنزيل الصوت.",
  FILESYSTEM_ERROR: "تعذر حفظ الصوت في مجلد التطبيق.",
};

function extractErrorCode(err: unknown): string | null {
  const msg = (err as Error)?.message || String(err || "");
  const prefixMatch = msg.match(/^([A-Z_]+):/);
  if (prefixMatch && prefixMatch[1] in ERROR_MAP) return prefixMatch[1];
  for (const code of Object.keys(ERROR_MAP)) {
    if (msg.includes(code)) return code;
  }
  return null;
}

function formatErrorMessage(err: unknown): string {
  if (!err) return "فشلت عملية المعالجة";
  const msg = (err as Error).message || String(err);
  const code = extractErrorCode(err);
  if (code) return ERROR_MAP[code];
  return msg.replace(/^[A-Z_]+:\s*/, "");
}

// --- Stage labels ---------------------------------------------------------------

const POEM_STAGE_LABELS: Record<string, string> = {
  queued: "بانتظار المعالجة",
  download: "تنزيل الصوت من المصدر",
  convert: "التحويل والمعايرة الصوتية",
  vad: "كشف فترات الكلام والصمت",
  asr: "التفريغ الصوتي بالذكاء الاصطناعي",
  align: "المحاذاة التلقائية للأبيات",
  saving: "حفظ القصيدة في الديوان",
  done: "اكتملت المعالجة",
};

const YOUTUBE_STAGE_LABELS: Record<string, string> = {
  queued: "بانتظار التنزيل",
  download: "تنزيل وتحويل الصوت",
  done: "اكتمل التنزيل",
};

export type ImportQueueNotificationKind = "success" | "error";

export interface ImportQueueNotification {
  id: string;
  jobId: string;
  kind: ImportQueueNotificationKind;
  message: string;
}

interface EnqueuePoemImportOptions {
  title: string;
  payload: PoemImportJobPayload;
}

interface EnqueueYoutubeDownloadOptions {
  title: string;
  payload: YoutubeDownloadJobPayload;
}

type JobCompletionListener = (job: ImportJob) => void;

interface ImportQueueContextValue {
  jobs: ImportJob[];
  isProcessing: boolean;
  enqueuePoemImport: (options: EnqueuePoemImportOptions) => string;
  enqueueYoutubeDownload: (options: EnqueueYoutubeDownloadOptions) => string;
  retryJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  getJobResult: <T>(jobId: string) => T | null;
  notifications: ImportQueueNotification[];
  dismissNotification: (id: string) => void;
  /** Subscribe to job completion/failure transitions (fires once per transition). Returns an unsubscribe fn. */
  subscribeToCompletion: (listener: JobCompletionListener) => () => void;
}

const ImportQueueContext = createContext<ImportQueueContextValue | null>(null);

function makeJobId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ImportQueueProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notifications, setNotifications] = useState<ImportQueueNotification[]>([]);

  const repoRef = useRef<DiwanRepository | null>(null);
  const jobsRef = useRef<ImportJob[]>([]);
  const processingRef = useRef(false);
  const completionListenersRef = useRef<Set<JobCompletionListener>>(new Set());
  // Per-job serialization: read-modify-write patches to the *same* job (a
  // pipeline stage persisting progress, and cancelJob flagging cancellation)
  // must never interleave, or whichever write lands last silently discards
  // the other's change. Chaining onto a per-jobId promise guarantees every
  // patch's read observes every previously-queued patch's write, regardless
  // of which call was *initiated* first.
  const jobLocksRef = useRef<Map<string, Promise<unknown>>>(new Map());

  const withJobLock = useCallback(<T,>(jobId: string, fn: () => Promise<T>): Promise<T> => {
    const prior = jobLocksRef.current.get(jobId) ?? Promise.resolve();
    const settled = prior.then(fn, fn);
    jobLocksRef.current.set(
      jobId,
      settled.catch(() => undefined)
    );
    return settled;
  }, []);

  const getRepo = useCallback(async (): Promise<DiwanRepository> => {
    if (!repoRef.current) {
      repoRef.current = await DiwanRepository.create();
    }
    return repoRef.current;
  }, []);

  const pushNotification = useCallback((jobId: string, kind: ImportQueueNotificationKind, message: string) => {
    const id = makeJobId("notif");
    setNotifications((prev) => [...prev, { id, jobId, kind, message }]);
    // Auto-dismiss after a while so the stack doesn't pile up.
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 8000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const upsertJobState = useCallback((job: ImportJob) => {
    // Compute the next array from jobsRef.current (our own synchronous source
    // of truth) rather than from React's "prev" inside a setState updater --
    // that updater only actually runs when React gets around to processing
    // the render, which is not guaranteed to happen before the very next
    // microtask. Code that awaits this same async chain (drainQueue looping
    // right after persistAndSet, or runJob reading the just-completed job)
    // would otherwise observe a stale jobsRef snapshot.
    const prev = jobsRef.current;
    const idx = prev.findIndex((j) => j.id === job.id);
    const next = idx === -1 ? [...prev, job] : prev.map((j) => (j.id === job.id ? job : j));
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const persistAndSet = useCallback(
    async (job: ImportJob) => {
      const repo = await getRepo();
      await repo.saveImportJob(job);
      upsertJobState(job);
      return job;
    },
    [getRepo, upsertJobState]
  );

  const notifyCompletionListeners = useCallback((job: ImportJob) => {
    completionListenersRef.current.forEach((listener) => listener(job));
  }, []);

  const subscribeToCompletion = useCallback((listener: JobCompletionListener) => {
    completionListenersRef.current.add(listener);
    return () => {
      completionListenersRef.current.delete(listener);
    };
  }, []);

  // --- Job processors -----------------------------------------------------

  const isCancelled = useCallback(async (jobId: string): Promise<boolean> => {
    const repo = await getRepo();
    const fresh = await repo.getImportJobById(jobId);
    return Boolean(fresh?.cancelRequested);
  }, [getRepo]);

  // Applies a partial patch on top of the job's *current persisted* state,
  // not the stale snapshot a long-running pipeline closure captured at
  // start-up. A pipeline stage that instead did `persistAndSet({ ...job,
  // stage, progress })` would silently overwrite fields mutated out-of-band
  // while it was running -- most importantly `cancelRequested`, which
  // cancelJob() sets independently while a stage is mid-flight.
  const patchJob = useCallback(
    async (jobId: string, patch: Partial<ImportJob>): Promise<ImportJob> =>
      withJobLock(jobId, async () => {
        const repo = await getRepo();
        const fresh = (await repo.getImportJobById(jobId)) ?? jobsRef.current.find((j) => j.id === jobId);
        if (!fresh) {
          throw new Error(`Import job not found while patching: ${jobId}`);
        }
        const merged: ImportJob = { ...fresh, ...patch };
        await repo.saveImportJob(merged);
        upsertJobState(merged);
        return merged;
      }),
    [getRepo, upsertJobState, withJobLock]
  );

  const processPoemImportJob = useCallback(
    async (job: ImportJob) => {
      const payload: PoemImportJobPayload = JSON.parse(job.payload);
      const {
        title,
        poetName,
        era,
        bahr,
        rhyme,
        parsedVerses,
        audioSourceMode,
        youtubeUrl,
        youtubeCookies,
        localAudioPath,
        localAudioName,
        importedFromMizan,
        mizanPoemId,
        mizanUrl,
      } = payload;

      let youtubeInfo = payload.youtubeInfo || null;
      let youtubeCoverImage = payload.youtubeCoverImage || null;

      const poemId = `poem-wiz-${job.id}`;
      const recId = `rec-wiz-${job.id}`;

      let sourceAudioPath = localAudioPath || "/recordings/mutanabbi_waharra.mp3";
      let processingWavPath = "/recordings/mutanabbi_waharra_16k.wav";
      let durationMs = 0;

      const setStage = async (stage: string, progress: number) => {
        await patchJob(job.id, { stage, stageLabel: POEM_STAGE_LABELS[stage] || stage, progress, status: "processing" });
      };

      const downloadWithCancellation = async (
        url: string,
        dir: string,
        quality: "128k" | "192k",
        cookies?: string
      ) => {
        try {
          return await downloadYoutubeAudio(url, dir, quality, job.id, cookies);
        } catch (err) {
          // A user-requested cancellation kills the worker process, which
          // surfaces here as an ordinary download failure. Cancellation
          // intent (recorded via cancelJob) is authoritative over whatever
          // error message the killed process happened to produce.
          if (await isCancelled(job.id)) throw new CancelledError();
          throw err;
        }
      };

      // Stage 1: Download (YouTube)
      if (await isCancelled(job.id)) throw new CancelledError();
      if (audioSourceMode === "youtube" && youtubeUrl) {
        await setStage("download", 0.05);
        if (!youtubeInfo) {
          try {
            youtubeInfo = await fetchYoutubeVideoInfo(youtubeUrl.trim(), 3600, youtubeCookies);
          } catch (infoErr) {
            console.warn("Could not fetch YouTube video info before download:", infoErr);
          }
        }
        if (!youtubeCoverImage && youtubeInfo?.thumbnail) {
          try {
            youtubeCoverImage = (await downloadYoutubeThumbnail(youtubeInfo.thumbnail)) || youtubeInfo.thumbnail;
          } catch {
            youtubeCoverImage = youtubeInfo.thumbnail;
          }
        }

        const targetDir = await getPoemRecordingDirectory(poemId, recId);
        const ytRes = await downloadWithCancellation(youtubeUrl, targetDir, "192k", youtubeCookies);
        sourceAudioPath = ytRes.playback_audio_path;
        processingWavPath = ytRes.processing_audio_path;
        durationMs = ytRes.duration_ms;
        await setStage("download", 0.2);
      }

      if (await isCancelled(job.id)) throw new CancelledError();

      // Stage 2: Convert (local file)
      await setStage("convert", 0.3);
      if (audioSourceMode === "local" && localAudioPath && localAudioName) {
        sourceAudioPath = await copyAudioToAppData(localAudioPath, localAudioName);
        processingWavPath = sourceAudioPath.replace(/\.[^.]+$/, "_16k.wav");
        await convertAudioFile(sourceAudioPath, processingWavPath);
        if (!durationMs) {
          try {
            const meta = await inspectAudioFile(sourceAudioPath);
            durationMs = meta.duration_ms;
          } catch {
            // duration stays 0 (unknown); never fabricated
          }
        }
      }
      await setStage("convert", 0.4);

      if (await isCancelled(job.id)) throw new CancelledError();

      // Stage 3: VAD
      await setStage("vad", 0.5);
      await detectSpeechIntervals(processingWavPath);
      await setStage("vad", 0.55);

      if (await isCancelled(job.id)) throw new CancelledError();

      // Stage 4: ASR
      await setStage("asr", 0.6);
      const transcription = await transcribeArabicAudio(processingWavPath, undefined, {
        model_size: "small",
        device: "cpu",
      });
      await setStage("asr", 0.75);

      if (await isCancelled(job.id)) throw new CancelledError();

      // Stage 5: Forced alignment
      await setStage("align", 0.8);
      const alignRes = await alignPoemAudio(
        processingWavPath,
        parsedVerses.map((v) => ({
          id: `v-${poemId}-${v.orderIndex}`,
          orderIndex: v.orderIndex,
          text: v.text,
          firstHemistich: v.firstHemistich,
          secondHemistich: v.secondHemistich,
        })),
        poemId,
        recId,
        { transcript: transcription.transcript }
      );
      await setStage("align", 0.92);

      if (await isCancelled(job.id)) throw new CancelledError();

      // Stage 6: Save
      await setStage("saving", 0.95);
      const finalPoem: Poem = {
        id: poemId,
        title: title.trim() || "قصيدة جديدة",
        poet: {
          id: `poet-${job.id}`,
          name: poetName.trim() || "شاعر",
          era,
        },
        era,
        bahr,
        rhyme: rhyme || "الميم",
        versesCount: parsedVerses.length,
        tags: ["مستورد عبر المعالج", `بحر ${bahr}`],
        externalProvider: importedFromMizan ? "mizan_al_arab" : undefined,
        externalId: importedFromMizan ? mizanPoemId || undefined : undefined,
        sourceUrl: importedFromMizan ? mizanUrl : undefined,
        coverImageUrl: youtubeCoverImage || youtubeInfo?.thumbnail || undefined,
        verses: parsedVerses.map((v) => {
          const alignmentItem = alignRes.alignments.find((a) => a.order_index === v.orderIndex);
          return {
            id: `v-${poemId}-${v.orderIndex}`,
            poemId,
            orderIndex: v.orderIndex,
            text: v.text,
            normalizedText: normalizeArabic(v.text),
            firstHemistich: v.firstHemistich,
            secondHemistich: v.secondHemistich,
            externalId: importedFromMizan ? v.externalId : undefined,
            alignment: alignmentItem
              ? {
                  id: `align-${poemId}-${v.orderIndex}`,
                  verseId: `v-${poemId}-${v.orderIndex}`,
                  recordingId: recId,
                  startMs: alignmentItem.start_ms,
                  endMs: alignmentItem.end_ms,
                  confidence: alignmentItem.confidence,
                  status: alignmentItem.status,
                }
              : undefined,
          };
        }),
        recordings: [
          {
            id: recId,
            poemId,
            title: youtubeInfo?.title || localAudioName || "تسجيل صوتي",
            reciter: poetName.trim(),
            audioPath: sourceAudioPath,
            durationMs,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const repo = await getRepo();
      await repo.savePoem(finalPoem);

      const result: PoemImportJobResult = { poemId: finalPoem.id, poemTitle: finalPoem.title };
      return patchJob(job.id, {
        stage: "done",
        stageLabel: POEM_STAGE_LABELS.done,
        progress: 1,
        status: "completed",
        resultJson: JSON.stringify(result),
      });
    },
    [getRepo, isCancelled, patchJob]
  );

  const processYoutubeDownloadJob = useCallback(
    async (job: ImportJob) => {
      const payload: YoutubeDownloadJobPayload = JSON.parse(job.payload);
      await patchJob(job.id, {
        stage: "download",
        stageLabel: YOUTUBE_STAGE_LABELS.download,
        progress: 0.2,
        status: "processing",
      });

      if (await isCancelled(job.id)) throw new CancelledError();

      const poemUuid = `poem-${job.id}`;
      const recUuid = `rec-${job.id}`;
      const targetDir = await getPoemRecordingDirectory(poemUuid, recUuid);
      let res: WorkerYouTubeDownloadData;
      try {
        res = await downloadYoutubeAudio(
          payload.videoInfo.webpage_url,
          targetDir,
          payload.quality,
          job.id,
          payload.cookies
        );
      } catch (err) {
        // See downloadWithCancellation above: a user cancellation kills the
        // worker process, which otherwise looks like an ordinary failure.
        if (await isCancelled(job.id)) throw new CancelledError();
        throw err;
      }

      const result: YoutubeDownloadJobResult = { download: res, videoInfo: payload.videoInfo };
      return patchJob(job.id, {
        stage: "done",
        stageLabel: YOUTUBE_STAGE_LABELS.done,
        progress: 1,
        status: "completed",
        resultJson: JSON.stringify(result),
      });
    },
    [isCancelled, patchJob]
  );

  const runJob = useCallback(
    async (job: ImportJob) => {
      try {
        let finished: ImportJob;
        if (job.jobType === "poem_import") {
          finished = await processPoemImportJob(job);
        } else if (job.jobType === "youtube_download") {
          finished = await processYoutubeDownloadJob(job);
        } else {
          throw new Error(`نوع مهمة غير مدعوم: ${job.jobType}`);
        }
        notifyCompletionListeners(finished);
        pushNotification(
          job.id,
          "success",
          job.jobType === "poem_import"
            ? `تم إنشاء قصيدة "${job.title}" بنجاح ومعالجتها بالكامل.`
            : `اكتمل تنزيل الصوت لـ "${job.title}".`
        );
      } catch (err) {
        if (err instanceof CancelledError) {
          const cancelled = await patchJob(job.id, {
            status: "cancelled",
            stage: "cancelled",
            stageLabel: "تم الإلغاء",
            cancelRequested: false,
          });
          notifyCompletionListeners(cancelled);
          return;
        }
        const message = formatErrorMessage(err);
        const failed = await patchJob(job.id, {
          status: "failed",
          errorMessage: message,
        });
        notifyCompletionListeners(failed);
        pushNotification(job.id, "error", `فشلت مهمة "${job.title}": ${message}`);
      }
    },
    [processPoemImportJob, processYoutubeDownloadJob, notifyCompletionListeners, pushNotification, patchJob]
  );

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = jobsRef.current
          .filter((j) => j.status === "pending")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        if (!next) break;
        await persistAndSet({ ...next, status: "processing" });
        await runJob(next);
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [persistAndSet, runJob]);

  // Startup recovery: load persisted jobs, mark interrupted "processing" jobs
  // as failed (their in-memory pipeline state was lost), and resume any
  // still-pending jobs automatically.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const repo = await getRepo();
      const persisted = await repo.getAllImportJobs();
      if (cancelled) return;

      const recovered: ImportJob[] = [];
      for (const job of persisted) {
        if (job.status === "processing") {
          const failedJob: ImportJob = {
            ...job,
            status: "failed",
            errorMessage: "توقف التطبيق أثناء المعالجة قبل الاكتمال. يرجى إعادة المحاولة.",
          };
          await repo.saveImportJob(failedJob);
          recovered.push(failedJob);
        } else {
          recovered.push(job);
        }
      }
      if (cancelled) return;
      setJobs(recovered);
      jobsRef.current = recovered;
      if (recovered.some((j) => j.status === "pending")) {
        drainQueue();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enqueuePoemImport = useCallback(
    ({ title, payload }: EnqueuePoemImportOptions): string => {
      const id = makeJobId("job-poem");
      const now = new Date().toISOString();
      const job: ImportJob = {
        id,
        status: "pending",
        jobType: "poem_import",
        title,
        stage: "queued",
        stageLabel: POEM_STAGE_LABELS.queued,
        progress: 0,
        retryCount: 0,
        maxRetries: 3,
        cancelRequested: false,
        payload: JSON.stringify(payload),
        notified: false,
        createdAt: now,
        updatedAt: now,
      };
      persistAndSet(job)
        .then(() => drainQueue())
        .catch((err) => console.error("Failed to enqueue/drain poem import job:", err));
      return id;
    },
    [persistAndSet, drainQueue]
  );

  const enqueueYoutubeDownload = useCallback(
    ({ title, payload }: EnqueueYoutubeDownloadOptions): string => {
      const id = makeJobId("job-yt");
      const now = new Date().toISOString();
      const job: ImportJob = {
        id,
        status: "pending",
        jobType: "youtube_download",
        title,
        stage: "queued",
        stageLabel: YOUTUBE_STAGE_LABELS.queued,
        progress: 0,
        retryCount: 0,
        maxRetries: 3,
        cancelRequested: false,
        payload: JSON.stringify(payload),
        notified: false,
        createdAt: now,
        updatedAt: now,
      };
      persistAndSet(job)
        .then(() => drainQueue())
        .catch((err) => console.error("Failed to enqueue/drain YouTube download job:", err));
      return id;
    },
    [persistAndSet, drainQueue]
  );

  const retryJob = useCallback(
    (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;
      patchJob(jobId, {
        status: "pending",
        stage: "queued",
        stageLabel: job.jobType === "poem_import" ? POEM_STAGE_LABELS.queued : YOUTUBE_STAGE_LABELS.queued,
        progress: 0,
        errorMessage: undefined,
        cancelRequested: false,
        retryCount: job.retryCount + 1,
      })
        .then(() => drainQueue())
        .catch((err) => console.error("Failed to retry/drain job:", err));
    },
    [patchJob, drainQueue]
  );

  const cancelJob = useCallback(
    (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;
      if (job.status === "pending") {
        patchJob(jobId, { status: "cancelled", stage: "cancelled", stageLabel: "تم الإلغاء" }).catch((err) =>
          console.error("Failed to cancel pending job:", err)
        );
        return;
      }
      // Processing: set the cooperative cancellation flag; the running stage
      // will observe it before the next step. Also ask the worker to stop an
      // in-flight YouTube download immediately.
      patchJob(jobId, { cancelRequested: true }).catch((err) => console.error("Failed to flag job cancellation:", err));
      cancelYoutubeDownload(jobId).catch(() => {});
    },
    [patchJob]
  );

  const dismissJob = useCallback(
    (jobId: string) => {
      const next = jobsRef.current.filter((j) => j.id !== jobId);
      jobsRef.current = next;
      setJobs(next);
      getRepo().then((repo) => repo.deleteImportJob(jobId));
    },
    [getRepo]
  );

  const getJobResult = useCallback(<T,>(jobId: string): T | null => {
    const job = jobsRef.current.find((j) => j.id === jobId);
    if (!job?.resultJson) return null;
    try {
      return JSON.parse(job.resultJson) as T;
    } catch {
      return null;
    }
  }, []);

  const value: ImportQueueContextValue = {
    jobs,
    isProcessing,
    enqueuePoemImport,
    enqueueYoutubeDownload,
    retryJob,
    cancelJob,
    dismissJob,
    getJobResult,
    notifications,
    dismissNotification,
    subscribeToCompletion,
  };

  return <ImportQueueContext.Provider value={value}>{children}</ImportQueueContext.Provider>;
}

class CancelledError extends Error {
  constructor() {
    super("CANCELLED");
  }
}

export function useImportQueueContext(): ImportQueueContextValue {
  const ctx = useContext(ImportQueueContext);
  if (!ctx) {
    throw new Error("useImportQueueContext must be used within an ImportQueueProvider");
  }
  return ctx;
}
