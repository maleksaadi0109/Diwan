import { Verse } from "@/types";

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
}

export type StateListener = (state: AudioPlayerState) => void;

export class AudioController {
  private audio: HTMLAudioElement | null = null;
  private verses: Verse[] = [];
  private state: AudioPlayerState;
  private listeners: Set<StateListener> = new Set();
  private rafId: number | null = null;
  private simulatedTimer: ReturnType<typeof setInterval> | null = null;

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
    };

    if (typeof window !== "undefined" && typeof Audio !== "undefined") {
      this.initAudioElement();
    }
  }

  private initAudioElement() {
    this.audio = new Audio();
    this.audio.preload = "auto";

    this.audio.addEventListener("loadedmetadata", () => {
      if (this.audio) {
        const dur = Math.round(this.audio.duration * 1000) || 0;
        this.updateState({
          durationMs: dur,
          status: "paused",
          errorMessage: null,
        });
      }
    });

    this.audio.addEventListener("timeupdate", () => {
      if (this.audio && !this.state.isPlaying) {
        this.updateCurrentTime(Math.round(this.audio.currentTime * 1000));
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
    const activeIndex = this.findActiveVerseIndex(this.state.currentTimeMs);
    this.updateState({
      activeVerseIndex: activeIndex,
      activeVerse: activeIndex >= 0 ? this.verses[activeIndex] : null,
    });
  }

  public loadAudio(src: string, defaultDurationMs?: number) {
    this.stopPrecisionLoop();
    this.clearSimulation();

    if (!src) {
      this.updateState({
        status: "idle",
        isPlaying: false,
        currentTimeMs: 0,
        durationMs: defaultDurationMs || 0,
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
        durationMs: defaultDurationMs || 0,
        errorMessage: null,
      });
      this.audio.load();
    } else {
      // Fallback in environments without HTML5 Audio
      this.updateState({
        status: "paused",
        currentTimeMs: 0,
        durationMs: defaultDurationMs || 60000,
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
          // If local test audio cannot play or in mock mode, simulate playback
          this.startSimulation();
        }
      }
    } else {
      // Simulation mode for tests / mock audio
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
  }

  public togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seekTo(timeMs: number): void {
    const clamped = Math.max(0, Math.min(timeMs, this.state.durationMs || Infinity));
    if (this.audio && isFinite(this.audio.duration)) {
      this.audio.currentTime = clamped / 1000;
    }
    this.updateCurrentTime(clamped);
  }

  public seekToVerse(verse: Verse): void {
    if (verse.alignment) {
      this.seekTo(verse.alignment.startMs);
    } else {
      const fallbackMs = (verse.orderIndex - 1) * 8000;
      this.seekTo(fallbackMs);
    }
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

  public findActiveVerseIndex(timeMs: number): number {
    if (this.verses.length === 0) return -1;

    // Check exact alignment boundaries first
    for (let i = 0; i < this.verses.length; i++) {
      const v = this.verses[i];
      if (v.alignment) {
        if (timeMs >= v.alignment.startMs && timeMs < v.alignment.endMs) {
          return i;
        }
      }
    }

    // If in gap between verses with alignments, find nearest preceding verse
    for (let i = this.verses.length - 1; i >= 0; i--) {
      const v = this.verses[i];
      if (v.alignment && timeMs >= v.alignment.startMs) {
        return i;
      }
    }

    // Fallback heuristic if no verse has alignments
    const hasAnyAlignment = this.verses.some((v) => !!v.alignment);
    if (!hasAnyAlignment) {
      const fallbackIdx = Math.floor(timeMs / 8000);
      return Math.max(0, Math.min(fallbackIdx, this.verses.length - 1));
    }

    return -1;
  }

  private updateCurrentTime(timeMs: number) {
    const activeIndex = this.findActiveVerseIndex(timeMs);
    this.updateState({
      currentTimeMs: timeMs,
      activeVerseIndex: activeIndex,
      activeVerse: activeIndex >= 0 ? this.verses[activeIndex] : null,
    });
  }

  private startPrecisionLoop() {
    this.stopPrecisionLoop();
    if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return;

    let lastUpdateTime = 0;
    const tick = (now: number) => {
      if (this.audio && this.state.isPlaying) {
        const current = Math.round(this.audio.currentTime * 1000);
        const activeIdx = this.findActiveVerseIndex(current);
        const verseChanged = activeIdx !== this.state.activeVerseIndex;

        // Update immediately on verse change, or throttle to ~35ms intervals (30fps) for smooth progress
        if (verseChanged || now - lastUpdateTime >= 35) {
          lastUpdateTime = now;
          this.updateCurrentTime(current);
        }
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopPrecisionLoop() {
    if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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
        this.updateCurrentTime(next);
      }
    }, 50);
  }

  private clearSimulation() {
    if (this.simulatedTimer) {
      clearInterval(this.simulatedTimer);
      this.simulatedTimer = null;
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Send initial state immediately
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
