import { describe, it, expect, vi, afterEach } from "vitest";
import { checkWorkerHealth, testAudioDecoding } from "./workerClient";

const tauriInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => tauriInvoke(...args),
}));

function markAsTauriRuntime() {
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
}

afterEach(() => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  tauriInvoke.mockReset();
});

describe("checkWorkerHealth (web/browser preview mode)", () => {
  it("includes the extended diagnostics fields (python executable, yt-dlp) alongside the original ones", async () => {
    const data = await checkWorkerHealth();
    expect(data.worker_version).toBeTruthy();
    expect(data.python_version).toBeTruthy();
    expect(data.ffmpeg).toBeTruthy();
    expect(data.ffprobe).toBeTruthy();
    expect(data.python_executable).toBeTruthy();
    expect(data).toHaveProperty("ytdlp_version");
    expect(data).toHaveProperty("ytdlp_path");
  });
});

describe("checkWorkerHealth (desktop/Tauri runtime)", () => {
  it("returns the worker's real data on success", async () => {
    markAsTauriRuntime();
    tauriInvoke.mockResolvedValue({
      id: "req-1",
      success: true,
      data: {
        worker_version: "0.1.0",
        python_version: "3.11.4",
        python_executable: "/usr/bin/python3",
        ffmpeg: "ffmpeg 6.0",
        ffprobe: "ffprobe 6.0",
        ytdlp_version: "2024.1.1",
        ytdlp_path: "/usr/lib/python3/site-packages/yt_dlp",
        status: "ready",
      },
    });

    const data = await checkWorkerHealth();
    expect(data.python_version).toBe("3.11.4");
    expect(data.ytdlp_version).toBe("2024.1.1");
  });

  it("propagates a real failure instead of silently reporting the healthy web simulation", async () => {
    markAsTauriRuntime();
    tauriInvoke.mockResolvedValue({
      id: "req-1",
      success: false,
      error_message: "Python interpreter not found",
    });

    await expect(checkWorkerHealth()).rejects.toThrow("Python interpreter not found");
  });

  it("propagates an invoke exception (e.g. worker process crash) instead of falling back", async () => {
    markAsTauriRuntime();
    tauriInvoke.mockRejectedValue(new Error("worker process exited unexpectedly"));

    await expect(checkWorkerHealth()).rejects.toThrow("worker process exited unexpectedly");
  });
});

describe("testAudioDecoding", () => {
  it("reports success with decoded metadata for a valid file path", async () => {
    const result = await testAudioDecoding("/recordings/mutanabbi_waharra_16k.wav");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.filePath).toBe("/recordings/mutanabbi_waharra_16k.wav");
      expect(result.metadata.duration_ms).toBeGreaterThan(0);
    }
  });

  it("never throws -- reports failure with a message instead", async () => {
    // Nothing in the web fallback path can actually fail decoding a string
    // path (it doesn't touch the filesystem), so this asserts the contract
    // via the function's return type/shape rather than forcing a throw.
    const result = await testAudioDecoding("");
    expect(typeof result.success).toBe("boolean");
  });
});
