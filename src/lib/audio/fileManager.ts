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
 * Converts a filesystem audio path to a streaming URL for HTML5 Audio
 */
export function resolveAudioSrc(audioPath: string): string {
  if (!audioPath) return "";
  if (audioPath.startsWith("http://") || audioPath.startsWith("https://") || audioPath.startsWith("blob:")) {
    return audioPath;
  }

  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  if (isTauri) {
    try {
      const { convertFileSrc } = (window as unknown as { __TAURI_CORE__?: { convertFileSrc: (p: string) => string } }).__TAURI_CORE__ || {};
      if (typeof convertFileSrc === "function") {
        return convertFileSrc(audioPath);
      }
      return `asset://localhost/${encodeURIComponent(audioPath)}`;
    } catch {
      return audioPath;
    }
  }

  if (!audioPath.startsWith("/") && !audioPath.startsWith("./")) {
    return `/${audioPath}`;
  }
  return audioPath;
}
