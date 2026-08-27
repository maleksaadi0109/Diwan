import { Router, type IRouter } from "express";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
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

async function runWorker(
  command: string,
  payload: Record<string, unknown>,
  jobId?: string,
): Promise<Record<string, unknown>> {
  const requestId = `api-${command}-${randomUUID()}`;
  const child = spawn("python3", ["-m", "diwan_worker.cli"], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      PYTHONPATH: workerPath,
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
  const { url, max_duration_seconds: maxDuration = 3600 } = req.body || {};
  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error_code: "INVALID_URL", error_message: "رابط YouTube مطلوب" });
    return;
  }

  try {
    const data = await runWorker("youtube_info", {
      url: url.trim(),
      max_duration_seconds: Number(maxDuration) || 3600,
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

router.post("/youtube/download", async (req, res): Promise<void> => {
  const {
    url,
    quality = "192k",
    job_id: requestedJobId,
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

  res.type(fileName.endsWith(".wav") ? "audio/wav" : "audio/mpeg");
  createReadStream(resolvedPath).pipe(res);
});

export default router;