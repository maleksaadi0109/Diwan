import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AudioController } from "./AudioController";
import { Verse } from "@/types";
import { normalizeArabic } from "@/lib/utils";

describe("AudioController Engine", () => {
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
        startMs: 10400,
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
        startMs: 19100,
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

  it("finds active verse at exact millisecond boundaries", () => {
    // Before first verse start (0 to 2499ms) -> no exact active or nearest
    expect(controller.findActiveVerseIndex(0)).toBe(-1);
    expect(controller.findActiveVerseIndex(2499)).toBe(-1);

    // Exact start of Verse 1 (2500ms)
    expect(controller.findActiveVerseIndex(2500)).toBe(0);

    // Inside Verse 1 (5000ms)
    expect(controller.findActiveVerseIndex(5000)).toBe(0);

    // End of Verse 1 boundary (9799ms -> v1, 9800ms -> gap retains v1)
    expect(controller.findActiveVerseIndex(9799)).toBe(0);
    expect(controller.findActiveVerseIndex(9800)).toBe(0); // in gap between v1 and v2

    // Exact start of Verse 2 (10400ms)
    expect(controller.findActiveVerseIndex(10400)).toBe(1);
    expect(controller.findActiveVerseIndex(15000)).toBe(1);
    expect(controller.findActiveVerseIndex(18599)).toBe(1);

    // Exact start of Verse 3 (19100ms)
    expect(controller.findActiveVerseIndex(19100)).toBe(2);
    expect(controller.findActiveVerseIndex(27499)).toBe(2);
  });

  it("seeks accurately and clamps boundary values", () => {
    // Seek to normal time
    controller.seekTo(12000);
    expect(controller.getState().currentTimeMs).toBe(12000);
    expect(controller.getState().activeVerseIndex).toBe(1);

    // Seek negative clamps to 0
    controller.seekTo(-500);
    expect(controller.getState().currentTimeMs).toBe(0);

    // Seek beyond duration clamps to duration
    controller.seekTo(99999);
    expect(controller.getState().currentTimeMs).toBe(30000);
  });

  it("seeks directly to verse boundaries and navigates next/prev", () => {
    // Seek to Verse 2
    controller.seekToVerse(mockVerses[1]);
    expect(controller.getState().currentTimeMs).toBe(10400);
    expect(controller.getState().activeVerseIndex).toBe(1);

    // Next Verse -> Verse 3
    controller.nextVerse();
    expect(controller.getState().currentTimeMs).toBe(19100);
    expect(controller.getState().activeVerseIndex).toBe(2);

    // Prev Verse -> Verse 2
    controller.prevVerse();
    expect(controller.getState().currentTimeMs).toBe(10400);
    expect(controller.getState().activeVerseIndex).toBe(1);
  });

  it("manages playback rate, volume, and mute states", () => {
    controller.setPlaybackRate(1.25);
    expect(controller.getState().playbackRate).toBe(1.25);

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

  it("handles fallback calculation when verses have no alignment timestamps", () => {
    const unalignedVerses: Verse[] = [
      {
        id: "uv-1",
        poemId: "p-2",
        orderIndex: 1,
        text: "قفا نبك من ذكرى حبيب ومنزل",
        normalizedText: normalizeArabic("قفا نبك من ذكرى حبيب ومنزل"),
        firstHemistich: "قفا نبك",
        secondHemistich: "ومنزل",
      },
      {
        id: "uv-2",
        poemId: "p-2",
        orderIndex: 2,
        text: "بسقط اللوى بين الدخول فحومل",
        normalizedText: normalizeArabic("بسقط اللوى بين الدخول فحومل"),
        firstHemistich: "بسقط اللوى",
        secondHemistich: "فحومل",
      },
    ];

    controller.setVerses(unalignedVerses);
    expect(controller.findActiveVerseIndex(2000)).toBe(0);
    expect(controller.findActiveVerseIndex(10000)).toBe(1);
  });
});
