import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDiagnosticSampleAudioPath, testStoragePermissions } from "./fileManager";

const fsStore = new Map<string, string>();
const writeTextFile = vi.fn(async (path: string, contents: string) => {
  fsStore.set(path, contents);
});
const readTextFile = vi.fn(async (path: string) => {
  if (!fsStore.has(path)) throw new Error(`ENOENT: ${path}`);
  return fsStore.get(path) as string;
});
const remove = vi.fn(async (path: string) => {
  fsStore.delete(path);
});
const mkdir = vi.fn(async () => {});
const exists = vi.fn(async (path: string) => fsStore.has(path));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: (...args: [string, string]) => writeTextFile(...args),
  readTextFile: (...args: [string]) => readTextFile(...args),
  remove: (...args: [string]) => remove(...args),
  mkdir: (...args: unknown[]) => mkdir(...args),
  exists: (...args: [string]) => exists(...args),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: async () => "/app-data",
  join: async (...parts: string[]) => parts.join("/"),
  resolveResource: async (relative: string) => `/resources/${relative}`,
}));

function markAsTauriRuntime() {
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {};
}

afterEach(() => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  fsStore.clear();
  vi.clearAllMocks();
});

describe("getDiagnosticSampleAudioPath (web/browser preview mode)", () => {
  it("resolves to the bundled public sample recording used elsewhere as a fallback", async () => {
    const path = await getDiagnosticSampleAudioPath();
    expect(path).toBe("/recordings/mutanabbi_waharra_16k.wav");
  });
});

describe("getDiagnosticSampleAudioPath (desktop/Tauri runtime)", () => {
  it("resolves the bundled Tauri resource to a real filesystem path", async () => {
    markAsTauriRuntime();
    const path = await getDiagnosticSampleAudioPath();
    expect(path).toBe("/resources/samples/diagnostic-sample.wav");
  });
});

describe("testStoragePermissions (desktop/Tauri runtime)", () => {
  it("creates, writes, reads back, and deletes a file under the app-data directory", async () => {
    markAsTauriRuntime();
    const result = await testStoragePermissions();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.path).toContain("/app-data/diagnostics/");
      // The test file must be cleaned up -- nothing left behind.
      expect(fsStore.has(result.path)).toBe(false);
      expect(remove).toHaveBeenCalledWith(result.path);
    }
  });

  it("reports failure and still attempts cleanup when the readback doesn't match", async () => {
    markAsTauriRuntime();
    readTextFile.mockImplementationOnce(async () => "corrupted-content");

    const result = await testStoragePermissions();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      // Cleanup should still have been attempted for the file that was written.
      expect(remove).toHaveBeenCalledWith(result.path);
    }
  });
});

describe("testStoragePermissions (web/browser preview mode)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes, reads back, and deletes a marker value, reporting success", async () => {
    const result = await testStoragePermissions();
    expect(result.success).toBe(true);
    if (result.success) {
      // The marker key must have been cleaned up -- no lingering test data.
      const markerKey = result.path.match(/localStorage\["(.+)"\]/)?.[1];
      expect(markerKey).toBeTruthy();
      expect(localStorage.getItem(markerKey as string)).toBeNull();
    }
  });

  it("reports failure with a clear message when localStorage is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    // Simulate an environment where localStorage access throws (e.g. private
    // browsing mode with storage disabled), which is the realistic failure
    // mode this test guards against.
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError: storage disabled");
      },
    });

    try {
      const result = await testStoragePermissions();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });
});
