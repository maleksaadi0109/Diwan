import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemMediaSessionManager } from "./mediaSession";
import { Poem } from "@/types";

describe("SystemMediaSessionManager", () => {
  const mockPoem: Poem = {
    id: "media-poem-1",
    title: "قصيدة للمزامنة",
    poet: {
      id: "poet-1",
      name: "أبو العلاء المعري",
      era: "عباسي",
    },
    era: "عباسي",
    bahr: "الوافر",
    rhyme: "الميم",
    versesCount: 5,
    tags: [],
    recordings: [],
    verses: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates media metadata safely", () => {
    expect(() => {
      SystemMediaSessionManager.updateMetadata(mockPoem);
    }).not.toThrow();
  });

  it("updates playback state safely", () => {
    expect(() => {
      SystemMediaSessionManager.updatePlaybackState(true);
      SystemMediaSessionManager.updatePlaybackState(false);
    }).not.toThrow();
  });

  it("updates position state safely", () => {
    expect(() => {
      SystemMediaSessionManager.updatePositionState(5000, 20000, 1.0);
    }).not.toThrow();
  });

  it("registers and cleans up media session action handlers", () => {
    const playFn = vi.fn();
    const pauseFn = vi.fn();
    const nextFn = vi.fn();

    const cleanup = SystemMediaSessionManager.registerHandlers({
      onPlay: playFn,
      onPause: pauseFn,
      onNext: nextFn,
    });

    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
