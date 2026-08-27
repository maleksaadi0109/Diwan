import { Verse } from "@/types";
import {
  SyncAnchor,
  CalibrationResult,
  calculateCalibration,
  calibrateVerses,
} from "./calibration";

export type AudioPlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface AudioPlayerState {
  status: AudioPlayerStatus;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  activeVerseIndex: number;
  activeVerse: Verse | null;
  errorMessage: string | null;
  calibration?: CalibrationResult;
  fps?: number;
}

export type StateListener = (state: AudioPlayerState) => void;

/**
 * Fast binary search for active verse lookup:
 * start_ms <= currentMs && currentMs < end_ms
 */
export function findActiveVerseIndexBinary(verses: Verse[], currentMs: number): number {
  if (!verses || verses.length === 0) return -1;

  let low = 0;
  let high = verses.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const v = verses[mid];
    const startMs = v.alignment ? Number(v.alignment.startMs) : mid * 8000;
    const endMs = v.alignment ? Number(v.alignment.endMs) : (mid + 1) * 8000;

    if (currentMs >= startMs && currentMs < endMs) {
      return mid;
    } else if (currentMs < startMs) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // Before first verse
  const firstStart = verses[0]?.alignment ? Number(verses[0].alignment.startMs) : 0;
  if (currentMs < firstStart) return 0;

  // After last verse
  const lastEnd = verses[verses.length - 1]?.alignment
    ? Number(verses[verses.length - 1].alignment!.endMs)
    : verses.length * 8000;
  if (currentMs >= lastEnd) return verses.length - 1;

  // Nearest preceding verse boundary
  for (let i = verses.length - 1; i >= 0; i--) {
    const v = verses[i];
    const s = v.alignment ? Number(v.alignment.startMs) : i * 8000;
    if (currentMs >= s) return i;
  }

  return 0;
}

export class AudioController {
  private audio: HTMLAudioElement | null = null;
  private verses: Verse[] = [];
  private state: AudioPlayerState;
  private listeners: Set<StateListener> = new Set();
  private rafId: number | null = null;
  private simulatedTimer: ReturnType<typeof setInterval> | null = null;
  private anchor1: SyncAnchor | null = null;
  private anchor2: SyncAnchor | null = null;

  // Telemetry
  private frameCount: number = 0;
  private calculatedFps: number = 60;
  private fpsTimer: number = 0;

  constructor() {
    this.state = {
      status: "idle",
      isPlaying: false,
      currentTimeMs: 0,
      durationMs: 0,
      playbackRate: 1.0,
      volume: 0.85,
      isMuted: false,
      activeVerseIndex: -1,
      activeVerse: null,
      errorMessage: null,
      fps: 60,
    };

    if (typeof window !== "undefined" && typeof Audio !== "undefined") {
      this.initAudioElement();
    }
  }

  private initAudioElement() {
    if (this.audio) return;

    this.audio = new Audio();
    this.audio.preload = "auto";

    // Immediate recomputation on audio lifecycle events
    this.audio.addEventListener("loadedmetadata", () => {
      if (this.audio && isFinite(this.audio.duration)) {
        const durMs = Math.round(this.audio.duration * 1000);
        this.updateState({
          durationMs: durMs,
          status: "paused",
          errorMessage: null,
        });
        this.recomputeSyncImmediately();
      }
    });

    this.audio.addEventListener("seeking", () => {
      this.recomputeSyncImmediately();
    });

    this.audio.addEventListener("seeked", () => {
      this.recomputeSyncImmediately();
    });

    this.audio.addEventListener("ratechange", () => {
      if (this.audio) {
        this.updateState({ playbackRate: this.audio.playbackRate });
        this.recomputeSyncImmediately();
      }
    });

    this.audio.addEventListener("ended", () => {
      this.stopPrecisionLoop();
      this.updateState({
        isPlaying: false,
        status: "ended",
        currentTimeMs: this.state.durationMs,
      });
    });

    this.audio.addEventListener("error", () => {
      this.stopPrecisionLoop();
      const code = this.audio?.error?.code;
      let errorMsg = "تعذر تشغيل الملف الصوتي";

      if (code === 4) {
        errorMsg = "لم يتم العثور على الملف الصوتي في المسار المحدد (Missing file)";
      } else if (code === 3) {
        errorMsg = "ترميز الملف الصوتي غير مدعوم أو تالف (Unsupported codec)";
      }

      this.updateState({
        status: "error",
        isPlaying: false,
        errorMessage: errorMsg,
      });
    });
  }

  public setVerses(verses: Verse[]) {
    this.verses = verses;
    this.recomputeSyncImmediately();
  }

  public getVerses(): Verse[] {
    return this.verses;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.audio;
  }

  public loadAudio(src: string, fallbackDurationMs?: number) {
    this.stopPrecisionLoop();
    this.clearSimulation();

    if (!src) {
      this.updateState({
        status: "idle",
        isPlaying: false,
        currentTimeMs: 0,
        durationMs: fallbackDurationMs || 0,
        activeVerseIndex: -1,
        activeVerse: null,
        errorMessage: null,
      });
      return;
    }

    if (this.audio) {
      this.audio.src = src;
      this.audio.playbackRate = this.state.playbackRate;
      this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
      this.updateState({
        status: "loading",
        currentTimeMs: 0,
        durationMs: fallbackDurationMs || 0,
        errorMessage: null,
      });
      this.audio.load();
    } else {
      this.updateState({
        status: "paused",
        currentTimeMs: 0,
        durationMs: fallbackDurationMs || 60000,
        errorMessage: null,
      });
    }
  }

  public async play(): Promise<void> {
    if (this.state.isPlaying) return;

    if (this.audio && this.audio.src) {
      try {
        await this.audio.play();
        this.updateState({
          isPlaying: true,
          status: "playing",
          errorMessage: null,
        });
        this.startPrecisionLoop();
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (error.name === "NotAllowedError") {
          this.updateState({
            status: "error",
            isPlaying: false,
            errorMessage: "التشغيل التلقائي محظور حتى يتفاعل المستخدم مع الصفحة",
          });
        } else {
          this.startSimulation();
        }
      }
    } else {
      this.startSimulation();
    }
  }

  public pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.stopPrecisionLoop();
    this.clearSimulation();
    this.updateState({
      isPlaying: false,
      status: "paused",
    });
    this.recomputeSyncImmediately();
  }

  public togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seekTo(timeMs: number): void {
    const clampedMs = Math.max(0, Math.min(timeMs, this.state.durationMs || Infinity));
    if (this.audio && isFinite(this.audio.duration)) {
      this.audio.currentTime = clampedMs / 1000;
    }
    this.recomputeSyncImmediately(clampedMs);
  }

  public seekToVerse(verse: Verse): void {
    const startMs = verse.alignment ? Number(verse.alignment.startMs) : (verse.orderIndex - 1) * 8000;
    this.seekTo(startMs);
  }

  public nextVerse(): void {
    const nextIdx = this.state.activeVerseIndex + 1;
    if (nextIdx < this.verses.length) {
      this.seekToVerse(this.verses[nextIdx]);
    }
  }

  public prevVerse(): void {
    const prevIdx = this.state.activeVerseIndex - 1;
    if (prevIdx >= 0) {
      this.seekToVerse(this.verses[prevIdx]);
    } else {
      this.seekTo(0);
    }
  }

  public setPlaybackRate(rate: number): void {
    const validRate = Math.max(0.25, Math.min(rate, 3.0));
    if (this.audio) {
      this.audio.playbackRate = validRate;
    }
    this.updateState({ playbackRate: validRate });
    this.recomputeSyncImmediately();
  }

  public setVolume(vol: number): void {
    const validVol = Math.max(0, Math.min(vol, 1.0));
    if (this.audio) {
      this.audio.volume = this.state.isMuted ? 0 : validVol;
    }
    this.updateState({ volume: validVol });
  }

  public toggleMute(): void {
    const nextMuted = !this.state.isMuted;
    if (this.audio) {
      this.audio.volume = nextMuted ? 0 : this.state.volume;
    }
    this.updateState({ isMuted: nextMuted });
  }

  public findActiveVerseIndex(currentMs: number): number {
    return findActiveVerseIndexBinary(this.verses, currentMs);
  }

  /**
   * Immediately recomputes active verse index on seeking, seeked, ratechange, or loadedmetadata
   */
  public recomputeSyncImmediately(explicitMs?: number): void {
    let currentMs = explicitMs;
    if (currentMs === undefined) {
      currentMs = this.audio ? Math.round(this.audio.currentTime * 1000) : this.state.currentTimeMs;
    }

    const activeIndex = this.findActiveVerseIndex(currentMs);
    const activeVerse = activeIndex >= 0 && activeIndex < this.verses.length ? this.verses[activeIndex] : null;

    this.updateState({
      currentTimeMs: currentMs,
      activeVerseIndex: activeIndex,
      activeVerse,
    });
  }

  /**
   * requestAnimationFrame synchronization loop:
   * - Computes active verse on every frame via binary search
   * - Triggers active verse transition immediately
   * - Tracks live FPS
   */
  private startPrecisionLoop() {
    this.stopPrecisionLoop();
    if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return;

    let lastTimelineUpdate = 0;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    const sync = (now: number) => {
      if (!this.audio || this.audio.paused || !this.state.isPlaying) {
        return;
      }

      // FPS tracking
      this.frameCount++;
      if (now - this.fpsTimer >= 500) {
        this.calculatedFps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
        this.frameCount = 0;
        this.fpsTimer = now;
      }

      const currentMs = Math.round(this.audio.currentTime * 1000);
      const activeIdx = findActiveVerseIndexBinary(this.verses, currentMs);
      const verseChanged = activeIdx !== this.state.activeVerseIndex;

      // Active verse highlight changes IMMEDIATELY without delay
      if (verseChanged) {
        const activeVerse = activeIdx >= 0 && activeIdx < this.verses.length ? this.verses[activeIdx] : null;
        this.updateState({
          currentTimeMs: currentMs,
          activeVerseIndex: activeIdx,
          activeVerse,
          fps: this.calculatedFps,
        });
        lastTimelineUpdate = now;
      } else if (now - lastTimelineUpdate >= 40) {
        // Scrubber progress update at smooth ~25fps
        lastTimelineUpdate = now;
        this.updateState({
          currentTimeMs: currentMs,
          fps: this.calculatedFps,
        });
      }

      this.rafId = requestAnimationFrame(sync);
    };

    this.rafId = requestAnimationFrame(sync);
  }

  private stopPrecisionLoop() {
    if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // --- Calibration Engine ---
  public setCalibrationAnchor(verseId: string, actualAudioMs: number): CalibrationResult {
    const verse = this.verses.find((v) => v.id === verseId);
    const originalStartMs = verse?.alignment?.startMs ?? 0;

    const anchor: SyncAnchor = {
      verseId,
      originalStartMs,
      actualAudioMs,
    };

    if (!this.anchor1) {
      this.anchor1 = anchor;
    } else {
      this.anchor2 = anchor;
    }

    const calibration = calculateCalibration(this.anchor1, this.anchor2 || undefined);
    this.verses = calibrateVerses(this.verses, calibration);
    this.updateState({ calibration });
    this.recomputeSyncImmediately();

    return calibration;
  }

  public clearCalibration(): void {
    this.anchor1 = null;
    this.anchor2 = null;
    this.updateState({ calibration: undefined });
    this.recomputeSyncImmediately();
  }

  private startSimulation() {
    this.clearSimulation();
    this.updateState({
      isPlaying: true,
      status: "playing",
      errorMessage: null,
    });

    let last = Date.now();
    this.simulatedTimer = setInterval(() => {
      const now = Date.now();
      const delta = (now - last) * this.state.playbackRate;
      last = now;

      const next = this.state.currentTimeMs + delta;
      if (next >= this.state.durationMs && this.state.durationMs > 0) {
        this.clearSimulation();
        this.updateState({
          isPlaying: false,
          status: "ended",
          currentTimeMs: this.state.durationMs,
        });
      } else {
        const activeIdx = findActiveVerseIndexBinary(this.verses, next);
        const activeVerse = activeIdx >= 0 && activeIdx < this.verses.length ? this.verses[activeIdx] : null;
        this.updateState({
          currentTimeMs: next,
          activeVerseIndex: activeIdx,
          activeVerse,
        });
      }
    }, 30);
  }

  private clearSimulation() {
    if (this.simulatedTimer) {
      clearInterval(this.simulatedTimer);
      this.simulatedTimer = null;
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): AudioPlayerState {
    return this.state;
  }

  private updateState(partial: Partial<AudioPlayerState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  public destroy() {
    this.stopPrecisionLoop();
    this.clearSimulation();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    this.listeners.clear();
  }
}
