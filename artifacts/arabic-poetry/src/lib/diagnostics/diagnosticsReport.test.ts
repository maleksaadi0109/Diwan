import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  collectDiagnosticsSnapshot,
  runAudioDecodeTest,
  runStorageTest,
  exportDiagnosticsReport,
  DiagnosticsReport,
} from "./diagnosticsReport";

describe("collectDiagnosticsSnapshot (web/browser preview mode)", () => {
  it("reports the web platform, an app version, and worker health", async () => {
    const snapshot = await collectDiagnosticsSnapshot();
    expect(snapshot.platform).toBe("web");
    expect(snapshot.appVersion).toBeTruthy();
    expect(snapshot.generatedAt).toBeTruthy();
    expect(snapshot.worker.ok).toBe(true);
  });
});

describe("runAudioDecodeTest / runStorageTest", () => {
  it("runs the audio decode test against the bundled sample when no file is given", async () => {
    const result = await runAudioDecodeTest();
    expect(result?.success).toBe(true);
    if (result?.success) {
      expect(result.filePath).toBe("/recordings/mutanabbi_waharra_16k.wav");
    }
  });

  it("runs the storage permissions test", async () => {
    const result = await runStorageTest();
    expect(result?.success).toBe(true);
  });
});

describe("exportDiagnosticsReport (web/browser preview mode)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers a browser download of the JSON report and reports success", async () => {
    // jsdom doesn't implement anchor.click() navigation; stub it so the
    // download attempt doesn't throw, without needing to intercept
    // createElement itself.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    const report: DiagnosticsReport = {
      generatedAt: new Date().toISOString(),
      appVersion: "0.0.0-test",
      platform: "web",
      worker: { ok: true, data: { worker_version: "1", python_version: "3", ffmpeg: "a", ffprobe: "b", status: "ready" } },
    };

    const result = await exportDiagnosticsReport(report);

    expect(result.success).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });
});
