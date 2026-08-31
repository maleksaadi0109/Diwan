export interface PickedAudioResult {
  path: string;
  name: string;
  size?: number;
}

export async function pickAudioFile(): Promise<PickedAudioResult | null> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "الملفات الصوتية المدعومة",
            extensions: ["mp3", "m4a", "ogg", "flac", "wav"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        const name = selected.split("/").pop()?.split("\\").pop() || "recording.mp3";
        return {
          path: selected,
          name,
        };
      }
      return null;
    } catch (err) {
      console.error("Failed to open Tauri file dialog:", err);
    }
  }

  // Web Browser fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/flac,.mp3,.wav,.ogg,.m4a,.flac";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        resolve({
          path: objectUrl,
          name: file.name,
          size: file.size,
        });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Copies selected audio to application data directory with collision-safe name
 */
export async function copyAudioToAppData(
  sourcePath: string,
  originalName: string
): Promise<string> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { appDataDir, join } = await import("@tauri-apps/api/path");
      const { copyFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

      const baseDir = await appDataDir();
      const recordingsDir = await join(baseDir, "recordings");

      const dirExists = await exists(recordingsDir);
      if (!dirExists) {
        await mkdir(recordingsDir, { recursive: true });
      }

      const timestamp = Date.now();
      const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetFilename = `${timestamp}_${cleanName}`;
      const targetPath = await join(recordingsDir, targetFilename);

      await copyFile(sourcePath, targetPath);
      return targetPath;
    } catch (err) {
      console.warn("Could not copy to AppData, using source path:", err);
      return sourcePath;
    }
  }

  // Web mode
  return sourcePath;
}

/**
 * Synchronously converts an audio path to a streaming/asset URL
 */
export function resolveAudioSrc(audioPath: string): string {
  if (!audioPath) return "";
  if (
    audioPath.startsWith("http://") ||
    audioPath.startsWith("https://") ||
    audioPath.startsWith("blob:") ||
    audioPath.startsWith("data:") ||
    audioPath.startsWith("asset://")
  ) {
    return audioPath;
  }

  // Relative public asset paths (e.g. "recordings/mutanabbi_waharra.mp3" or "/recordings/...")
  const isAbsolute = audioPath.startsWith("/") || audioPath.includes(":\\") || audioPath.startsWith("\\\\");

  if (!isAbsolute) {
    return `/${audioPath.replace(/^\.?\//, '')}`;
  }

  // Absolute filesystem paths (e.g. local recordings downloaded or saved on disk)
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  if (isTauri) {
    try {
      const internals = (window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc?: (p: string, protocol?: string) => string } }).__TAURI_INTERNALS__;
      if (internals && typeof internals.convertFileSrc === "function") {
        return internals.convertFileSrc(audioPath);
      }
      return `http://asset.localhost/${encodeURIComponent(audioPath)}`;
    } catch {
      return audioPath;
    }
  }

  return audioPath.startsWith("/") ? audioPath : `/${audioPath}`;
}

const blobUrlCache = new Map<string, string>();

async function resolveDesktopPlaybackPath(audioPath: string): Promise<string> {
  if (!/\.mp3$/i.test(audioPath)) return audioPath;

  const desktopWavPath = audioPath.replace(/\.mp3$/i, ".desktop.wav");

  try {
    const { exists, remove } = await import("@tauri-apps/plugin-fs");
    if (!(await exists(desktopWavPath))) {
      const { convertAudioFile } = await import("@/lib/worker/workerClient");
      try {
        await convertAudioFile(audioPath, desktopWavPath, "playback");
      } catch (conversionError) {
        // A failed/interrupted conversion can leave a partial WAV. Remove it
        // so the next playback attempt can retry cleanly.
        if (await exists(desktopWavPath)) {
          await remove(desktopWavPath);
        }
        throw conversionError;
      }
    }
    return desktopWavPath;
  } catch (err) {
    // Keep MP3 as a fallback rather than making an existing recording
    // completely unplayable if ffmpeg or the worker is unavailable.
    console.warn("Could not prepare seek-stable desktop WAV; using original audio:", err);
    return audioPath;
  }
}

/**
 * Asynchronously resolves an audio path into a playable HTML5 Audio URL.
 * In Tauri desktop environments, it reads the audio file bytes via Tauri FS
 * and creates a Blob URL, completely bypassing WebKit2GTK asset protocol issues.
 */
export async function resolveAudioSrcAsync(audioPath: string): Promise<string> {
  if (!audioPath) return "";
  if (
    audioPath.startsWith("http://") ||
    audioPath.startsWith("https://") ||
    audioPath.startsWith("blob:") ||
    audioPath.startsWith("data:")
  ) {
    return audioPath;
  }

  if (blobUrlCache.has(audioPath)) {
    return blobUrlCache.get(audioPath)!;
  }

  const isAbsolute = audioPath.startsWith("/") || audioPath.includes(":\\") || audioPath.startsWith("\\\\");
  if (!isAbsolute) {
    return `/${audioPath.replace(/^\.?\//, '')}`;
  }

  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  if (isTauri) {
    try {
      const playbackPath = await resolveDesktopPlaybackPath(audioPath);
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(playbackPath);
      const ext = playbackPath.split('.').pop()?.toLowerCase();
      const mime = ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(audioPath, blobUrl);
      return blobUrl;
    } catch (err) {
      console.warn("Could not read file via tauri-plugin-fs, falling back to resolveAudioSrc:", err);
      return resolveAudioSrc(audioPath);
    }
  }

  return resolveAudioSrc(audioPath);
}

/**
 * Resolves a filesystem path to the small bundled sample recording used by
 * the diagnostics screen's "test audio decoding" action, so it always has
 * something to decode without requiring the user to pick a file first.
 *
 * On desktop this is bundled as a Tauri resource (see `bundle.resources` in
 * `src-tauri/tauri.conf.json`) and resolved to its real on-disk path, since
 * the Python worker needs an actual filesystem path, not a webview URL. On
 * the web it reuses the same public asset already used elsewhere as a
 * playback fallback.
 */
export async function getDiagnosticSampleAudioPath(): Promise<string> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { resolveResource } = await import("@tauri-apps/api/path");
      return await resolveResource("samples/diagnostic-sample.wav");
    } catch (err) {
      console.warn("Could not resolve bundled diagnostic sample resource:", err);
    }
  }

  return "/recordings/mutanabbi_waharra_16k.wav";
}

/**
 * Verifies the app can create, write, read back, and delete a file under
 * its own app-data directory (desktop) or its equivalent persistent store
 * (the browser's localStorage, which is what `WebMemoryAdapter` itself
 * relies on in web preview mode). Never throws -- failures are reported in
 * the returned result for the diagnostics screen.
 */
export async function testStoragePermissions(): Promise<
  { success: true; path: string } | { success: false; path: string; error: string }
> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  const marker = `diwan-diagnostics-${Date.now()}`;

  if (isTauri) {
    let testFilePath = "";
    try {
      const { appDataDir, join } = await import("@tauri-apps/api/path");
      const { writeTextFile, readTextFile, remove, mkdir, exists } = await import("@tauri-apps/plugin-fs");

      const baseDir = await appDataDir();
      const diagnosticsDir = await join(baseDir, "diagnostics");
      if (!(await exists(diagnosticsDir))) {
        await mkdir(diagnosticsDir, { recursive: true });
      }

      testFilePath = await join(diagnosticsDir, `${marker}.tmp`);
      await writeTextFile(testFilePath, marker);
      const readBack = await readTextFile(testFilePath);
      if (readBack !== marker) {
        throw new Error("محتوى الملف المقروء لا يطابق ما تمت كتابته");
      }
      await remove(testFilePath);
      return { success: true, path: testFilePath };
    } catch (err) {
      const error = err as Error;
      // Best-effort cleanup: if writing succeeded but a later step in the
      // test failed, don't leave the temp file behind under the user's
      // app-data directory.
      if (testFilePath) {
        try {
          const { remove, exists } = await import("@tauri-apps/plugin-fs");
          if (await exists(testFilePath)) {
            await remove(testFilePath);
          }
        } catch {
          // Cleanup is best-effort; the original error is what matters.
        }
      }
      return { success: false, path: testFilePath, error: error.message || "فشل اختبار صلاحيات التخزين" };
    }
  }

  // Web fallback: localStorage is the persistent store the browser preview
  // mode actually depends on (see WebMemoryAdapter), so exercising it here
  // is the equivalent read/write/delete cycle for that environment.
  try {
    if (typeof localStorage === "undefined") {
      throw new Error("التخزين المحلي (localStorage) غير متاح في هذه البيئة");
    }
    localStorage.setItem(marker, marker);
    const readBack = localStorage.getItem(marker);
    if (readBack !== marker) {
      throw new Error("محتوى القيمة المقروءة لا يطابق ما تمت كتابته");
    }
    localStorage.removeItem(marker);
    return { success: true, path: `localStorage["${marker}"]` };
  } catch (err) {
    const error = err as Error;
    return { success: false, path: `localStorage["${marker}"]`, error: error.message || "فشل اختبار صلاحيات التخزين" };
  }
}

/**
 * Resolves and creates canonical directories for a poem recording:
 * appDataDir/poems/{poemUuid}/recordings/{recordingUuid}/
 */
export async function getPoemRecordingDirectory(
  poemUuid: string,
  recordingUuid: string
): Promise<string> {
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { appDataDir, join } = await import("@tauri-apps/api/path");
      const { mkdir, exists } = await import("@tauri-apps/plugin-fs");

      const base = await appDataDir();
      const recDir = await join(base, "poems", poemUuid, "recordings", recordingUuid);

      const rawDir = await join(recDir, "raw");
      const tempDir = await join(recDir, "temp");
      const finalDir = await join(recDir, "final");

      if (!(await exists(rawDir))) await mkdir(rawDir, { recursive: true });
      if (!(await exists(tempDir))) await mkdir(tempDir, { recursive: true });
      if (!(await exists(finalDir))) await mkdir(finalDir, { recursive: true });

      return recDir;
    } catch (err) {
      console.warn("Could not create structured recording directory, falling back:", err);
    }
  }

  return `recordings/${poemUuid}/${recordingUuid}`;
}
