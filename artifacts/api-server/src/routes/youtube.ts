import { Router, type IRouter } from "express";
import multer from "multer";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const workerPathCandidates = [
  path.resolve(process.cwd(), "artifacts", "arabic-poetry", "worker"),
  path.resolve(process.cwd(), "..", "arabic-poetry", "worker"),
  path.resolve(process.cwd(), "..", "..", "artifacts", "arabic-poetry", "worker"),
];
const workerPath = workerPathCandidates.find((candidate) => existsSync(candidate));
if (!workerPath) {
  throw new Error("Arabic poetry worker directory was not found");
}
const workspaceRoot = path.resolve(workerPath, "..", "..", "..");
const downloadRoot = path.join(workspaceRoot, ".data", "diwan-youtube");
const activeWorkers = new Map<string, ChildProcessWithoutNullStreams>();

interface WorkerEnvelope {
  type?: string;
  id?: string;
  success?: boolean;
  data?: Record<string, unknown>;
  error_code?: string;
  error_message?: string;
}

function isSafeJobId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

function workerError(envelope: WorkerEnvelope | undefined): Error {
  const code = envelope?.error_code || "DOWNLOAD_FAILED";
  const message = envelope?.error_message || "فشل تنفيذ عملية الصوت";
  return new Error(`${code}: ${message}`);
}

function resolveDownloadedAudioPath(audioPath: unknown): string {
  if (typeof audioPath !== "string" || !audioPath.trim()) {
    throw new Error("INVALID_AUDIO_PATH: مسار ملف الصوت مطلوب");
  }

  // Browser requests can only use files created by this API's YouTube
  // downloader. Never accept an arbitrary filesystem path from the client.
  const match = audioPath.match(
    /^\/api-worker\/youtube\/audio\/([a-zA-Z0-9_-]{1,80})\/(processing\.wav|playback\.mp3)$/,
  );
  if (!match) {
    throw new Error("INVALID_AUDIO_PATH: ملف الصوت يجب أن يكون من تنزيل YouTube");
  }

  const resolved = path.join(downloadRoot, match[1], "final", match[2]);
  if (!existsSync(resolved)) {
    throw new Error("FILE_NOT_FOUND: ملف الصوت المعالج غير موجود");
  }
  return resolved;
}

async function runWorker(
  command: string,
  payload: Record<string, unknown>,
  jobId?: string,
): Promise<Record<string, unknown>> {
  const requestId = `api-${command}-${randomUUID()}`;
  const isWin = process.platform === "win32";
  const pythonCmd = process.env.PYTHON || (isWin ? "python" : "python3");
  const child = spawn(pythonCmd, ["-m", "diwan_worker.cli"], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      PYTHONPATH: workerPath,
      PYTHONIOENCODING: "utf-8:backslashreplace",
      PYTHONUTF8: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (jobId) activeWorkers.set(jobId, child);

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error?: Error, data?: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      if (jobId) activeWorkers.delete(jobId);
      if (error) reject(error);
      else resolve(data || {});
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      const lines = stdout.split("\n");
      stdout = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const envelope = JSON.parse(line) as WorkerEnvelope;
          if (envelope.type === "progress") continue;
          if (envelope.success && envelope.data) {
            finish(undefined, envelope.data);
          } else {
            finish(workerError(envelope));
          }
        } catch {
          logger.warn({ command, line: line.slice(0, 200) }, "Ignoring malformed worker output");
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => finish(error));
    child.on("close", (code, signal) => {
      if (settled) return;
      const detail = stderr.trim().slice(-500);
      finish(
        new Error(
          `العامل الصوتي توقف قبل إرجاع نتيجة${signal ? ` (${signal})` : ` (code ${code ?? "unknown"})`}${detail ? `: ${detail}` : ""}`,
        ),
      );
    });

    child.stdin.end(
      JSON.stringify({
        id: requestId,
        command,
        payload,
      }) + "\n",
    );
  });
}

router.post("/youtube/info", async (req, res): Promise<void> => {
  const { url, max_duration_seconds: maxDuration = 3600, cookies_content: cookiesContent } = req.body || {};
  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error_code: "INVALID_URL", error_message: "رابط YouTube مطلوب" });
    return;
  }

  try {
    const data = await runWorker("youtube_info", {
      url: url.trim(),
      max_duration_seconds: Number(maxDuration) || 3600,
      cookies_content: typeof cookiesContent === "string" && cookiesContent.trim() ? cookiesContent : undefined,
    });
    res.json(data);
  } catch (error) {
    req.log.warn({ err: error }, "YouTube metadata lookup failed");
    const message = error instanceof Error ? error.message : "تعذر جلب بيانات YouTube";
    const [errorCode, ...rest] = message.split(":");
    res.status(502).json({
      error_code: errorCode || "DOWNLOAD_FAILED",
      error_message: rest.join(":").trim() || message,
    });
  }
});

const ALLOWED_THUMBNAIL_HOSTS = [
  "ytimg.com",
  "ggpht.com",
  "googleusercontent.com",
  "youtube.com",
];

router.post("/youtube/thumbnail", async (req, res): Promise<void> => {
  const { url } = req.body || {};
  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error_code: "INVALID_URL", error_message: "رابط الصورة مطلوب" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    res.status(400).json({ error_code: "INVALID_URL", error_message: "رابط الصورة غير صالح" });
    return;
  }

  const isAllowedHost =
    parsed.protocol === "https:" &&
    ALLOWED_THUMBNAIL_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  if (!isAllowedHost) {
    res.status(400).json({ error_code: "INVALID_HOST", error_message: "مصدر الصورة غير مسموح" });
    return;
  }

  try {
    const response = await fetch(parsed.toString());
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error("NOT_AN_IMAGE");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    res.json({ data_url: dataUrl, content_type: contentType });
  } catch (error) {
    req.log.warn({ err: error }, "YouTube thumbnail download failed");
    res.status(502).json({
      error_code: "THUMBNAIL_DOWNLOAD_FAILED",
      error_message: "تعذر تحميل صورة الغلاف",
    });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    proc.on("error", (error) => reject(new Error(`FFMPEG_NOT_FOUND: ${error.message}`)));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`CONVERSION_FAILED: فشل تحويل الملف الصوتي (${stderr.trim().slice(-300)})`));
    });
  });
}

function probeDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let stdout = "";
    proc.on("error", (error) => reject(new Error(`FFMPEG_NOT_FOUND: ${error.message}`)));
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("PROBE_FAILED: تعذر فحص مدة الملف الصوتي"));
        return;
      }
      const seconds = parseFloat(stdout.trim());
      resolve(Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0);
    });
  });
}

router.post("/audio/upload", upload.single("audio"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file || !file.buffer || file.buffer.length === 0) {
    res.status(400).json({ error_code: "INVALID_FILE", error_message: "ملف صوتي مطلوب" });
    return;
  }

  const jobId = `up-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const jobDir = path.join(downloadRoot, jobId);
  const rawDir = path.join(jobDir, "raw");
  const finalDir = path.join(jobDir, "final");

  try {
    await mkdir(rawDir, { recursive: true });
    await mkdir(finalDir, { recursive: true });

    const rawExt = path.extname(file.originalname || "").slice(0, 10) || ".bin";
    const rawPath = path.join(rawDir, `upload${rawExt}`);
    await writeFile(rawPath, file.buffer);

    const playbackPath = path.join(finalDir, "playback.mp3");
    const processingPath = path.join(finalDir, "processing.wav");

    await runFfmpeg(["-y", "-i", rawPath, "-vn", "-acodec", "libmp3lame", "-b:a", "192k", playbackPath]);
    await runFfmpeg([
      "-y",
      "-i",
      rawPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      processingPath,
    ]);

    const durationMs = await probeDurationMs(playbackPath);

    res.json({
      job_id: jobId,
      playback_audio_path: `/api-worker/youtube/audio/${jobId}/playback.mp3`,
      processing_audio_path: `/api-worker/youtube/audio/${jobId}/processing.wav`,
      duration_ms: durationMs,
    });
  } catch (error) {
    req.log.warn({ err: error, jobId }, "Audio upload processing failed");
    const message = error instanceof Error ? error.message : "فشل معالجة الملف الصوتي";
    const [errorCode, ...rest] = message.split(":");
    res.status(502).json({
      error_code: errorCode || "CONVERSION_FAILED",
      error_message: rest.join(":").trim() || message,
    });
  }
});

router.post("/youtube/download", async (req, res): Promise<void> => {
  const {
    url,
    quality = "192k",
    job_id: requestedJobId,
    cookies_content: cookiesContent,
  } = req.body || {};

  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error_code: "INVALID_URL", error_message: "رابط YouTube مطلوب" });
    return;
  }

  const jobId = isSafeJobId(requestedJobId) ? requestedJobId : `yt-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await mkdir(downloadRoot, { recursive: true });

  try {
    const data = await runWorker(
      "youtube_download",
      {
        url: url.trim(),
        output_dir: downloadRoot,
        quality: quality === "128k" ? "128k" : "192k",
        job_id: jobId,
        cookies_content: typeof cookiesContent === "string" && cookiesContent.trim() ? cookiesContent : undefined,
      },
      jobId,
    );

    const rawPath = typeof data.raw_audio_path === "string" ? data.raw_audio_path : "";
    const rawFormat = typeof data.raw_format === "string" ? data.raw_format : "unknown";
    res.json({
      ...data,
      job_id: jobId,
      raw_format: rawFormat,
      raw_audio_path: rawPath ? `/api-worker/youtube/audio/${jobId}/source.${rawFormat}` : "",
      playback_audio_path: `/api-worker/youtube/audio/${jobId}/playback.mp3`,
      processing_audio_path: `/api-worker/youtube/audio/${jobId}/processing.wav`,
    });
  } catch (error) {
    req.log.warn({ err: error, jobId }, "YouTube audio download failed");
    const message = error instanceof Error ? error.message : "فشل تنزيل الصوت";
    const [errorCode, ...rest] = message.split(":");
    res.status(502).json({
      error_code: errorCode || "DOWNLOAD_FAILED",
      error_message: rest.join(":").trim() || message,
      job_id: jobId,
    });
  }
});

router.post("/transcribe", async (req, res): Promise<void> => {
  const {
    audio_path: audioPath,
    model_size: modelSize = "small",
    device = "cpu",
    compute_type: computeType = "default",
  } = req.body || {};

  try {
    const localAudioPath = resolveDownloadedAudioPath(audioPath);
    const data = await runWorker("transcribe", {
      audio_path: localAudioPath,
      model_size: modelSize,
      device,
      compute_type: computeType,
      mock: false,
    });
    res.json(data);
  } catch (error) {
    req.log.warn({ err: error }, "Arabic transcription failed");
    const message = error instanceof Error ? error.message : "فشل تفريغ الصوت";
    const [errorCode, ...rest] = message.split(":");
    res.status(502).json({
      error_code: errorCode || "TRANSCRIPTION_FAILED",
      error_message: rest.join(":").trim() || message,
    });
  }
});

router.post("/align", async (req, res): Promise<void> => {
  const {
    audio_path: audioPath,
    verses,
    poem_id: poemId = "poem",
    recording_id: recordingId = "rec",
    transcript,
  } = req.body || {};

  if (!Array.isArray(verses) || verses.length === 0) {
    res.status(400).json({
      error_code: "INVALID_VERSES",
      error_message: "قائمة أبيات القصيدة مطلوبة للمحاذاة",
    });
    return;
  }

  try {
    const localAudioPath = resolveDownloadedAudioPath(audioPath);
    const data = await runWorker("align", {
      audio_path: localAudioPath,
      verses,
      poem_id: poemId,
      recording_id: recordingId,
      transcript,
      mock: false,
    });
    res.json(data);
  } catch (error) {
    req.log.warn({ err: error }, "Poem alignment failed");
    const message = error instanceof Error ? error.message : "فشل محاذاة القصيدة";
    const [errorCode, ...rest] = message.split(":");
    res.status(502).json({
      error_code: errorCode || "ALIGNMENT_FAILED",
      error_message: rest.join(":").trim() || message,
    });
  }
});

router.post("/youtube/cancel", (req, res): void => {
  const { job_id: jobId } = req.body || {};
  if (!isSafeJobId(jobId)) {
    res.status(400).json({ cancelled: false, error_code: "INVALID_JOB_ID" });
    return;
  }

  const child = activeWorkers.get(jobId);
  if (!child) {
    res.json({ cancelled: false, job_id: jobId });
    return;
  }

  child.kill("SIGTERM");
  res.json({ cancelled: true, job_id: jobId });
});

router.get("/youtube/audio/:jobId/:fileName", (req, res): void => {
  const { jobId, fileName } = req.params;
  if (!isSafeJobId(jobId) || !/^(?:playback\.mp3|processing\.wav|source\.(?:webm|m4a|opus|mp3|wav|ogg))$/.test(fileName)) {
    res.status(400).json({ error_code: "INVALID_AUDIO_PATH" });
    return;
  }

  const filePath = path.join(downloadRoot, jobId, "final", fileName);
  const rawPath = path.join(downloadRoot, jobId, "raw", fileName);
  const resolvedPath = existsSync(filePath) ? filePath : rawPath;
  if (!existsSync(resolvedPath)) {
    res.status(404).json({ error_code: "FILE_NOT_FOUND", error_message: "ملف الصوت غير موجود" });
    return;
  }

  const fileSize = statSync(resolvedPath).size;
  const range = req.headers.range;
  res.type(fileName.endsWith(".wav") ? "audio/wav" : "audio/mpeg");
  res.setHeader("Accept-Ranges", "bytes");

  if (!range) {
    res.setHeader("Content-Length", fileSize);
    createReadStream(resolvedPath).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
    res.end();
    return;
  }

  const start = match[1] ? Number.parseInt(match[1], 10) : 0;
  const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
  const end = Math.min(requestedEnd, fileSize - 1);

  if (start < 0 || start >= fileSize || end < start) {
    res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
    res.end();
    return;
  }

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Content-Length", end - start + 1);
  createReadStream(resolvedPath, { start, end }).pipe(res);
});

export default router;