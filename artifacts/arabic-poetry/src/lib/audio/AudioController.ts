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

export const FORWARD_SWITCH_MARGIN_MS = 60;

/**
 * Robust active verse resolution:
 * Matches timestamp to exact verse intervals, inter-verse pauses, or edges.
 */
export function findActiveVerseIndexBinary(verses: Verse[], currentMs: number): number {
  if (!verses || verses.length === 0) return -1;

  const timedIndices: number[] = [];
  for (let i = 0; i < verses.length; i++) {
    if (verses[i].alignment) {
      timedIndices.push(i);
    }
  }

  if (timedIndices.length === 0) return -1;

  // 1. Check exact match inside verse boundaries
  for (const idx of timedIndices) {
    const v = verses[idx];
    const startMs = Number(v.alignment!.startMs);
    const endMs = Number(v.alignment!.endMs);
    if (currentMs >= startMs && currentMs < endMs) {
      return idx;
    }
  }

  // 2. Before the first timed verse's actual start (e.g. a recording with a
  // long intro/silence before the recitation begins), no verse is active
  // yet. Highlighting verse 1 immediately at time 0 would show the text
  // running far ahead of what's actually heard whenever there's meaningful
  // lead-in silence, so we wait until playback truly reaches it.
  const firstIdx = timedIndices[0];
  const firstStart = Number(verses[firstIdx].alignment!.startMs);
  if (currentMs < firstStart) {
    return -1;
  }

  // 3. If after the last timed verse, anchor to last timed verse
  const lastIdx = timedIndices[timedIndices.length - 1];
  const lastEnd = Number(verses[lastIdx].alignment!.endMs);
  if (currentMs >= lastEnd) {
    return lastIdx;
  }

  // 4. Inter-verse gap: anchor to the closest preceding verse
  let closestPreceding = firstIdx;
  for (const idx of timedIndices) {
    const startMs = Number(verses[idx].alignment!.startMs);
    if (currentMs >= startMs) {
      closestPreceding = idx;
    }
  }

  return closestPreceding;
}

export class AudioController {
  private audio: HTMLAudioElement | null = null;
  private currentSrc: string = "";
  private verses: Verse[] = [];
  private baselineVerses: Verse[] = [];
  private state: AudioPlayerState;
  private listeners: Set<StateListener> = new Set();
  private rafId: number | null = null;
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

    this.audio.addEventListener("canplay", () => {
      if (this.state.status === "loading") {
        this.updateState({ status: "paused", errorMessage: null });
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

    this.audio.addEventListener("playing", () => {
      this.updateState({ isPlaying: true, status: "playing" });
      this.startPrecisionLoop();
    });

    this.audio.addEventListener("timeupdate", () => {
      if (this.state.isPlaying) {
        this.recomputeSyncImmediately();
      }
    });

    this.audio.addEventListener("ended", () => {
      this.stopPrecisionLoop();
      // Use the audio element's own real position/duration rather than the
      // possibly-stale `state.durationMs` fallback (e.g. seeded from DB
      // metadata before the real file metadata loaded). Trusting a wrong,
      // larger `durationMs` here would make the UI display/seek past the
      // real end of the file.
      const realEndMs =
        this.audio && isFinite(this.audio.duration)
          ? Math.round(this.audio.duration * 1000)
          : this.state.durationMs;
      this.updateState({
        isPlaying: false,
        status: "ended",
        currentTimeMs: realEndMs,
        durationMs: realEndMs,
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
    this.baselineVerses = verses;
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
    if (this.currentSrc === src && this.audio && this.audio.src) {
      if (fallbackDurationMs && this.state.durationMs === 0) {
        this.updateState({ durationMs: fallbackDurationMs });
      }
      return;
    }

    this.stopPrecisionLoop();
    this.currentSrc = src;

    if (!src) {
      if (this.audio) {
        this.audio.pause();
        this.audio.src = "";
      }
      this.updateState({
        status: "idle",
        isPlaying: false,
        currentTimeMs: 0,
        durationMs: fallbackDurationMs || 0,
        errorMessage: null,
      });
      this.recomputeSyncImmediately(0);
      return;
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.src = src;
      this.audio.currentTime = 0;
      this.audio.playbackRate = this.state.playbackRate;
      this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
      this.updateState({
        status: "loading",
        isPlaying: false,
        currentTimeMs: 0,
        durationMs: fallbackDurationMs || 0,
        errorMessage: null,
      });
      // Resolve the real active verse for time 0 rather than assuming verse
      // 1 (see findActiveVerseIndexBinary: a recording can start with a
      // silent intro before verse 1 actually begins).
      this.recomputeSyncImmediately(0);
      this.audio.load();
    }
  }

  public play(): Promise<void> {
    if (this.state.isPlaying) return Promise.resolve();

    let playPromise: Promise<void> = Promise.resolve();
    if (this.audio && this.audio.src) {
      try {
        playPromise = this.audio.play().then(
          () => {},
          (err) => {
            console.warn("[AudioController] Audio element play REJECTED:", err?.name, err?.message, err);
            this.stopPrecisionLoop();
            this.updateState({
              isPlaying: false,
              status: "error",
              errorMessage: `تعذر بدء التشغيل: ${err?.name || "خطأ غير معروف"} — ${err?.message || ""}`,
            });
          }
        );
      } catch (err) {
        console.warn("[AudioController] Audio element play sync error:", err);
      }
    } else {
      console.warn("[AudioController] play() called but audio element or src missing", { hasAudio: !!this.audio, src: this.audio?.src });
    }

    this.updateState({
      isPlaying: true,
      status: "playing",
      errorMessage: null,
    });
    this.startPrecisionLoop();
    return playPromise;
  }

  public pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.stopPrecisionLoop();
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
      try {
        this.audio.currentTime = clampedMs / 1000;
      } catch (e) {
        console.warn("Failed to set audio currentTime:", e);
      }
    }
    this.recomputeSyncImmediately(clampedMs);
  }

  public seekToVerse(verse: Verse): void {
    if (!verse.alignment) return;
    this.seekTo(Number(verse.alignment.startMs));
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
   * Detects a spurious `currentTime` reading caused by the browser's
   * internal "probe seek": some engines determine a media file's real
   * duration by seeking far past the end (or to a huge/negative
   * placeholder) and then back to the actual position, firing `seeking`/
   * `timeupdate` with that bogus value in between. Reacting to it makes
   * playback appear to "jump to the end, then snap back to the start" --
   * exactly the intermediate reading, not real playback.
   *
   * We only trust readings within a small margin of the known duration
   * once it's established; before that (durationMs still 0) we can't tell,
   * so nothing is filtered.
   */
  private isImplausibleProbeReading(currentMs: number): boolean {
    if (!isFinite(currentMs) || currentMs < 0) return true;
    if (this.state.durationMs > 0 && currentMs > this.state.durationMs + 2000) return true;
    return false;
  }

  private computeStableActiveIndex(currentMs: number): number {
    let activeIdx = findActiveVerseIndexBinary(this.verses, currentMs);
    const prevIdx = this.state.activeVerseIndex;
    if (activeIdx === prevIdx + 1 && prevIdx >= 0 && activeIdx < this.verses.length) {
      const nextAlignment = this.verses[activeIdx].alignment;
      if (nextAlignment && currentMs < Number(nextAlignment.startMs) + FORWARD_SWITCH_MARGIN_MS) {
        activeIdx = prevIdx;
      }
    }
    return activeIdx;
  }

  public recomputeSyncImmediately(explicitMs?: number): void {
    let currentMs = explicitMs;
    if (currentMs === undefined) {
      currentMs = this.audio ? Math.round(this.audio.currentTime * 1000) : this.state.currentTimeMs;
      if (this.isImplausibleProbeReading(currentMs)) return;
    }

    const activeIndex = this.findActiveVerseIndex(currentMs);
    const activeVerse = activeIndex >= 0 && activeIndex < this.verses.length ? this.verses[activeIndex] : null;

    this.updateState({
      currentTimeMs: currentMs,
      activeVerseIndex: activeIndex,
      activeVerse,
    });
  }

  private startPrecisionLoop() {
    this.stopPrecisionLoop();
    if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return;

    let lastTimelineUpdate = 0;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    const sync = (now: number) => {
      if (!this.state.isPlaying) {
        return;
      }

      if (this.audio) {
        this.frameCount++;
        if (now - this.fpsTimer >= 500) {
          this.calculatedFps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
          this.frameCount = 0;
          this.fpsTimer = now;
        }

        const currentMs = Math.round(this.audio.currentTime * 1000);
        if (this.isImplausibleProbeReading(currentMs)) {
          this.rafId = requestAnimationFrame(sync);
          return;
        }
        const activeIdx = this.computeStableActiveIndex(currentMs);

        const verseChanged = activeIdx !== this.state.activeVerseIndex;

        if (verseChanged) {
          const activeVerse = activeIdx >= 0 && activeIdx < this.verses.length ? this.verses[activeIdx] : null;
          this.updateState({
            currentTimeMs: currentMs,
            activeVerseIndex: activeIdx,
            activeVerse,
            fps: this.calculatedFps,
          });
          lastTimelineUpdate = now;
        } else if (now - lastTimelineUpdate >= 30) {
          lastTimelineUpdate = now;
          this.updateState({
            currentTimeMs: currentMs,
            fps: this.calculatedFps,
          });
        }
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

  public setCalibrationAnchor(verseId: string, actualAudioMs: number): CalibrationResult {
    const verse = this.baselineVerses.find((v) => v.id === verseId);
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
    this.verses = calibrateVerses(this.baselineVerses, calibration);
    this.updateState({ calibration });
    this.recomputeSyncImmediately();

    return calibration;
  }

  public clearCalibration(): void {
    this.anchor1 = null;
    this.anchor2 = null;
    this.verses = this.baselineVerses;
    this.updateState({ calibration: undefined });
    this.recomputeSyncImmediately();
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
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    this.listeners.clear();
  }
}
