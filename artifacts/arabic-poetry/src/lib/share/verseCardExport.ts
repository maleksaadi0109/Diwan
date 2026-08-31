/**
 * Exports a rendered DOM node (a verse-share card) to a PNG file.
 *
 * On the web, this triggers a browser download. Inside the Tauri desktop
 * shell, it opens a native "Save As" dialog and writes the PNG bytes to
 * disk directly, mirroring the open()/save() pattern used for audio files
 * in `lib/audio/fileManager.ts`.
 */

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "بيت-شعر";
}

export async function exportCardNodeToPng(
  node: HTMLElement,
  suggestedFilename: string
): Promise<{ success: boolean; error?: string }> {
  const isTauri =
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  try {
    // Ensure webfonts (Amiri / Cairo) are fully loaded before rasterizing,
    // otherwise the capture can fall back to a system font mid-render.
    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.ready;
    }

    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: undefined,
      // The app's Arabic webfonts (Amiri/Cairo) are loaded from Google
      // Fonts via a cross-origin stylesheet. html-to-image's font-embedding
      // step tries to read `cssRules` off that stylesheet to inline it as
      // base64, which throws a CORS SecurityError in the browser. The fonts
      // are already loaded and applied in the live page (see the
      // `document.fonts.ready` wait above), so skipping re-embedding avoids
      // the console error without affecting how the rendered text looks.
      skipFonts: true,
    });

    const filename = `${sanitizeFilename(suggestedFilename)}.png`;

    if (isTauri) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");

      const targetPath = await save({
        defaultPath: filename,
        filters: [{ name: "صورة PNG", extensions: ["png"] }],
      });

      if (!targetPath) {
        return { success: false, error: "cancelled" };
      }

      await writeFile(targetPath, dataUrlToUint8Array(dataUrl));
      return { success: true };
    }

    // Web fallback: trigger a browser download.
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { success: true };
  } catch (err) {
    console.error("Failed to export verse card:", err);
    return { success: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
