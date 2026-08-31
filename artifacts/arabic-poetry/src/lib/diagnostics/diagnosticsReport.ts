import { checkWorkerHealth, WorkerHealthData, testAudioDecoding, WorkerAudioMetadata } from "@/lib/worker/workerClient";
import { getDiagnosticSampleAudioPath, testStoragePermissions } from "@/lib/audio/fileManager";

const isTauriRuntime = () =>
  typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export interface DiagnosticsReport {
  generatedAt: string;
  appVersion: string;
  platform: "desktop" | "web";
  userAgent?: string;
  worker: { ok: true; data: WorkerHealthData } | { ok: false; error: string };
  audioDecodeTest?:
    | { success: true; filePath: string; metadata: WorkerAudioMetadata }
    | { success: false; filePath: string; error: string };
  storageTest?: { success: true; path: string } | { success: false; path: string; error: string };
}

/** Resolves the app version shown in the diagnostics report -- the real
 * Tauri-bundled version on desktop (via the official app API, which stays
 * correct across bundle formats), falling back to the workspace
 * `package.json` version in the browser preview. */
async function resolveAppVersion(): Promise<string> {
  if (isTauriRuntime()) {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      return await getVersion();
    } catch (err) {
      console.warn("Could not resolve Tauri app version:", err);
    }
  }
  try {
    const pkg = await import("../../../package.json");
    return (pkg as { version?: string }).version || "unknown";
  } catch {
    return "unknown";
  }
}

/** Collects the read-only facts the diagnostics screen shows: app version
 * and worker/tooling health. Does not run the (user-triggered) audio decode
 * or storage tests -- those are collected separately and merged in via
 * `withTestResults` so they only run when the user asks for them. */
export async function collectDiagnosticsSnapshot(): Promise<Omit<DiagnosticsReport, "audioDecodeTest" | "storageTest">> {
  const appVersion = await resolveAppVersion();
  const platform: "desktop" | "web" = isTauriRuntime() ? "desktop" : "web";

  let worker: DiagnosticsReport["worker"];
  try {
    const data = await checkWorkerHealth();
    worker = { ok: true, data };
  } catch (err) {
    const error = err as Error;
    worker = { ok: false, error: error.message || "تعذر الاتصال بمعالج الصوتيات" };
  }

  return {
    generatedAt: new Date().toISOString(),
    appVersion,
    platform,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    worker,
  };
}

/** Runs the audio-decode test against the bundled sample (or a caller-
 * provided file path) and returns its outcome. */
export async function runAudioDecodeTest(customFilePath?: string): Promise<DiagnosticsReport["audioDecodeTest"]> {
  const filePath = customFilePath || (await getDiagnosticSampleAudioPath());
  return testAudioDecoding(filePath);
}

/** Runs the storage read/write/delete permissions test. */
export async function runStorageTest(): Promise<DiagnosticsReport["storageTest"]> {
  return testStoragePermissions();
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "diwan-diagnostics";
}

/**
 * Serializes a diagnostics report to formatted JSON and saves it: a native
 * "Save As" dialog on desktop (mirroring the pattern used for verse-card
 * PNG export), or a browser download on the web.
 */
export async function exportDiagnosticsReport(
  report: DiagnosticsReport
): Promise<{ success: boolean; error?: string }> {
  const isTauri = isTauriRuntime();
  const json = JSON.stringify(report, null, 2);
  const filename = sanitizeFilename(`diwan-diagnostics-${report.generatedAt.replace(/[:.]/g, "-")}`) + ".json";

  try {
    if (isTauri) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");

      const targetPath = await save({
        defaultPath: filename,
        filters: [{ name: "تقرير تشخيصي JSON", extensions: ["json"] }],
      });

      if (!targetPath) {
        return { success: false, error: "cancelled" };
      }

      await writeTextFile(targetPath, json);
      return { success: true };
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    console.error("Failed to export diagnostics report:", err);
    return { success: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
