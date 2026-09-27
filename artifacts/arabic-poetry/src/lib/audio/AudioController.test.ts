import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AudioController, findActiveVerseIndexBinary } from "./AudioController";
import { Verse } from "@/types";
import { normalizeArabic } from "@/lib/utils";

describe("AudioController Engine & Synchronization Architecture", () => {
  let controller: AudioController;

  const mockVerses: Verse[] = [
    {
      id: "v-1",
      poemId: "poem-1",
      orderIndex: 1,
      text: "واحر قلباه ممن قلبه شبم ... ومن بجسمي وحالي عنده سقم",
      normalizedText: normalizeArabic("واحر قلباه ممن قلبه شبم ومن بجسمي وحالي عنده سقم"),
      firstHemistich: "واحر قلباه ممن قلبه شبم",
      secondHemistich: "ومن بجسمي وحالي عنده سقم",
      alignment: {
        id: "align-1",
        verseId: "v-1",
        recordingId: "rec-1",
        startMs: 2500,
        endMs: 9800,
        confidence: 0.95,
        status: "reviewed",
      },
    },
    {
      id: "v-2",
      poemId: "poem-1",
      orderIndex: 2,
      text: "ما لي أكتم حبا قد برى جسدي ... وتدعي حب سيف الدولة الأمم",
      normalizedText: normalizeArabic("ما لي اكتم حبا قد برى جسدي وتدعي حب سيف الدولة الامم"),
      firstHemistich: "ما لي أكتم حبا قد برى جسدي",
      secondHemistich: "وتدعي حب سيف الدولة الأمم",
      alignment: {
        id: "align-2",
        verseId: "v-2",
        recordingId: "rec-1",
        startMs: 9800,
        endMs: 18600,
        confidence: 0.92,
        status: "reviewed",
      },
    },
    {
      id: "v-3",
      poemId: "poem-1",
      orderIndex: 3,
      text: "إن كان يجمعنا حب لغرته ... فليت أنا بقدر الحب نقتسم",
      normalizedText: normalizeArabic("ان كان يجمعنا حب لغرته فليت انا بقدر الحب نقتسم"),
      firstHemistich: "إن كان يجمعنا حب لغرته",
      secondHemistich: "فليت أنا بقدر الحب نقتسم",
      alignment: {
        id: "align-3",
        verseId: "v-3",
        recordingId: "rec-1",
        startMs: 18600,
        endMs: 27500,
        confidence: 0.96,
        status: "reviewed",
      },
    },
  ];

  beforeEach(() => {
    controller = new AudioController();
    controller.setVerses(mockVerses);
    controller.loadAudio("", 30000);
  });

  afterEach(() => {
    controller.destroy();
  });

  it("finds active verse at exact start and end boundaries with binary search", () => {
    // Exact start boundary of Verse 1 (2500ms)
    expect(findActiveVerseIndexBinary(mockVerses, 2500)).toBe(0);
    expect(controller.findActiveVerseIndex(2500)).toBe(0);

    // Inside Verse 1 (5000ms)
    expect(controller.findActiveVerseIndex(5000)).toBe(0);

    // Exact end boundary of Verse 1 (9799ms -> v1, 9800ms -> v2 starts immediately)
    expect(controller.findActiveVerseIndex(9799)).toBe(0);
    expect(controller.findActiveVerseIndex(9800)).toBe(1);

    // Exact start of Verse 2 (9800ms) and end (18599ms)
    expect(controller.findActiveVerseIndex(9800)).toBe(1);
    expect(controller.findActiveVerseIndex(18599)).toBe(1);

    // Exact start of Verse 3 (18600ms)
    expect(controller.findActiveVerseIndex(18600)).toBe(2);
    expect(controller.findActiveVerseIndex(27499)).toBe(2);
  });

  it("shows no active verse during a long lead-in silence before verse 1 actually starts", () => {
    // mockVerses' verse 1 doesn't start until 2500ms; before that, nothing
    // has been recited yet, so no verse should be highlighted as active
    // (previously this incorrectly forced verse 1 active from time 0).
    expect(findActiveVerseIndexBinary(mockVerses, 0)).toBe(-1);
    expect(findActiveVerseIndexBinary(mockVerses, 2499)).toBe(-1);
    expect(findActiveVerseIndexBinary(mockVerses, 2500)).toBe(0);

    expect(controller.findActiveVerseIndex(0)).toBe(-1);
    controller.seekTo(0);
    expect(controller.getState().activeVerseIndex).toBe(-1);
    expect(controller.getState().activeVerse).toBeNull();
  });

  it("keeps the previous verse highlighted during a silent gap between verses", () => {
    const gappedVerses: Verse[] = mockVerses.map((v, i) => ({
      ...v,
      alignment: v.alignment
        ? {
            ...v.alignment,
            // Non-contiguous boundaries: gap between end and next start
            startMs: [2500, 11000, 20000][i],
            endMs: [9000, 18000, 27500][i],
          }
        : undefined,
    }));

    // Inside the silence between v1 (ends 9000) and v2 (starts 11000):
    // highlight must stay on v1, never jump early to v2.
    expect(findActiveVerseIndexBinary(gappedVerses, 9500)).toBe(0);
    expect(findActiveVerseIndexBinary(gappedVerses, 10999)).toBe(0);
    expect(findActiveVerseIndexBinary(gappedVerses, 11000)).toBe(1);
    // Silence between v2 and v3
    expect(findActiveVerseIndexBinary(gappedVerses, 19000)).toBe(1);
    expect(findActiveVerseIndexBinary(gappedVerses, 20000)).toBe(2);
  });

  it("returns -1 for a wholly unaligned poem (no fabricated 8s slots)", () => {
    const unaligned: Verse[] = mockVerses.map((v) => ({ ...v, alignment: undefined }));
    expect(findActiveVerseIndexBinary(unaligned, 0)).toBe(-1);
    expect(findActiveVerseIndexBinary(unaligned, 8500)).toBe(-1);
    expect(findActiveVerseIndexBinary(unaligned, 999999)).toBe(-1);
  });

  it("skips unaligned verses in a mixed poem instead of fabricating timing", () => {
    // Middle verse has no alignment: it must never be returned as active.
    const mixed: Verse[] = mockVerses.map((v, i) =>
      i === 1 ? { ...v, alignment: undefined } : v
    );
    const v0 = mixed[0].alignment!;
    const v2 = mixed[2].alignment!;
    // Inside v0's span
    expect(findActiveVerseIndexBinary(mixed, Number(v0.startMs) + 10)).toBe(0);
    // Between v0's end and v2's start: previous TIMED verse (0), never 1
    expect(findActiveVerseIndexBinary(mixed, Number(v0.endMs) + 10)).toBe(0);
    // Inside v2's span
    expect(findActiveVerseIndexBinary(mixed, Number(v2.startMs) + 10)).toBe(2);
    expect(findActiveVerseIndexBinary(mixed, Number(v2.endMs) + 999)).toBe(2);
  });

  it("handles seeking forward and backward with immediate active verse recomputation", () => {
    // Seek forward to Verse 2
    controller.seekTo(12000);
    expect(controller.getState().currentTimeMs).toBe(12000);
    expect(controller.getState().activeVerseIndex).toBe(1);
    expect(controller.getState().activeVerse?.id).toBe("v-2");

    // Seek forward to Verse 3
    controller.seekTo(22000);
    expect(controller.getState().currentTimeMs).toBe(22000);
    expect(controller.getState().activeVerseIndex).toBe(2);
    expect(controller.getState().activeVerse?.id).toBe("v-3");

    // Seek backward to Verse 1
    controller.seekTo(3000);
    expect(controller.getState().currentTimeMs).toBe(3000);
    expect(controller.getState().activeVerseIndex).toBe(0);
    expect(controller.getState().activeVerse?.id).toBe("v-1");
  });

  it("does not report playback when no audio source is loaded", async () => {
    await controller.play();
    expect(controller.getState().isPlaying).toBe(false);
    expect(controller.getState().status).toBe("idle");
  });

  it("handles pause and resume cleanly without duplicating loops or listeners", async () => {
    const audioElement = controller.getAudioElement();
    expect(audioElement).toBeDefined();
    if (!audioElement) return;

    vi.spyOn(audioElement, "play").mockResolvedValue();
    controller.loadAudio("blob:resume-test", 30000);

    await controller.play();
    expect(controller.getState().isPlaying).toBe(true);

    // Repeated play calls do not duplicate loops
    await controller.play();
    expect(controller.getState().isPlaying).toBe(true);

    controller.pause();
    expect(controller.getState().isPlaying).toBe(false);

    // Repeated pause calls do not throw
    controller.pause();
    expect(controller.getState().isPlaying).toBe(false);

    // Resume
    await controller.play();
    expect(controller.getState().isPlaying).toBe(true);
  });

  it("handles playbackRate changes and immediate sync", () => {
    controller.setPlaybackRate(1.5);
    expect(controller.getState().playbackRate).toBe(1.5);

    controller.setPlaybackRate(0.75);
    expect(controller.getState().playbackRate).toBe(0.75);
  });

  it("manages volume and mute states", () => {
    controller.setVolume(0.5);
    expect(controller.getState().volume).toBe(0.5);

    controller.toggleMute();
    expect(controller.getState().isMuted).toBe(true);
    controller.toggleMute();
    expect(controller.getState().isMuted).toBe(false);
  });

  it("subscribes and cleans up listeners without leaks", () => {
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    // Initial state sent on subscribe
    expect(listener).toHaveBeenCalledTimes(1);

    controller.seekTo(5000);
    expect(listener).toHaveBeenCalledTimes(2);

    // Unsubscribe
    unsubscribe();
    controller.seekTo(8000);
    // Listener should not be called again after unsubscribe
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("prepares loading state cleanly without setting error message", () => {
    controller.prepareLoading(25000);
    const state = controller.getState();
    expect(state.status).toBe("loading");
    expect(state.isPlaying).toBe(false);
    expect(state.errorMessage).toBeNull();
    expect(state.durationMs).toBe(25000);
  });

  it("does not set error message when error event fires while src is empty or not set", () => {
    const audioElement = controller.getAudioElement();
    expect(audioElement).toBeDefined();

    if (audioElement) {
      // Simulate browser firing an error event when src is empty / not set
      audioElement.dispatchEvent(new Event("error"));
      expect(controller.getState().errorMessage).toBeNull();
      expect(controller.getState().status).not.toBe("error");
    }
  });

  it("gracefully ignores AbortError when play request is interrupted by pause or track switch", async () => {
    const audioElement = controller.getAudioElement();
    if (audioElement) {
      const abortError = new DOMException(
        "The play() request was interrupted by a new load request.",
        "AbortError"
      );
      vi.spyOn(audioElement, "play").mockRejectedValueOnce(abortError);

      controller.loadAudio("blob:test-audio-1", 10000);
      await controller.play();

      expect(controller.getState().status).not.toBe("error");
      expect(controller.getState().errorMessage).toBeNull();
    }
  });

  it("safely switches audio tracks while playing without state collision or freeze", async () => {
    const audioElement = controller.getAudioElement();
    if (audioElement) {
      vi.spyOn(audioElement, "play").mockResolvedValue();
      vi.spyOn(audioElement, "pause").mockImplementation(() => {});

      // Track 1 starts playing
      controller.loadAudio("blob:poem-1", 20000);
      await controller.play();
      expect(controller.getState().isPlaying).toBe(true);
      expect(controller.getState().status).toBe("playing");

      // Switch to Track 2 immediately while Track 1 is playing
      controller.prepareLoading(15000);
      expect(controller.getState().status).toBe("loading");
      expect(controller.getState().isPlaying).toBe(false);
      expect(audioElement.getAttribute("src")).toBeNull();

      // A click while the next source is still resolving must not restart
      // the previous track or falsely report that playback began.
      await controller.play();
      expect(controller.getState().isPlaying).toBe(false);
      expect(controller.getState().status).toBe("loading");

      controller.loadAudio("blob:poem-2", 15000);
      await controller.play();

      expect(controller.getState().isPlaying).toBe(true);
      expect(controller.getState().status).toBe("playing");
      expect(controller.getState().errorMessage).toBeNull();

      // Switch to Track 3 which has no audio source ("")
      controller.loadAudio("", 10000);
      expect(controller.getState().isPlaying).toBe(false);
      expect(controller.getState().status).toBe("idle");
      expect(controller.getState().errorMessage).toBeNull();
    }
  });
});
