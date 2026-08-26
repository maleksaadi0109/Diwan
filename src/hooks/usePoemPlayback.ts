import { useState, useEffect, useRef, useCallback } from "react";
import { Poem, Verse } from "@/types";

export interface PlaybackState {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  volume: number;
  activeVerseIndex: number;
  activeVerse: Verse | null;
}

export function usePoemPlayback(poem: Poem | null) {
  const defaultRecording = poem?.recordings[0];
  const durationMs = defaultRecording?.durationMs || (poem ? poem.verses.length * 8000 : 60000);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(0.85);

  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  // Reset when poem changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeMs(0);
  }, [poem?.id]);

  // Determine active verse based on start_ms and end_ms
  const activeVerseIndex = poem?.verses.findIndex((v) => {
    if (v.alignment) {
      return (
        currentTimeMs >= v.alignment.startMs &&
        currentTimeMs < v.alignment.endMs
      );
    }
    // Fallback heuristic if no alignment exists
    const fallbackStart = (v.orderIndex - 1) * 8000;
    const fallbackEnd = v.orderIndex * 8000;
    return currentTimeMs >= fallbackStart && currentTimeMs < fallbackEnd;
  }) ?? -1;

  const activeVerse = (activeVerseIndex >= 0 && poem) ? poem.verses[activeVerseIndex] : null;

  // Animation loop for playback simulation
  useEffect(() => {
    if (!isPlaying) {
      lastTickRef.current = null;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const step = (timestamp: number) => {
      if (lastTickRef.current !== null) {
        const delta = (timestamp - lastTickRef.current) * playbackRate;
        setCurrentTimeMs((prev) => {
          const next = prev + delta;
          if (next >= durationMs) {
            setIsPlaying(false);
            return durationMs;
          }
          return next;
        });
      }
      lastTickRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playbackRate, durationMs]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && currentTimeMs >= durationMs) {
        setCurrentTimeMs(0);
      }
      return !prev;
    });
  }, [currentTimeMs, durationMs]);

  const seekTo = useCallback((timeMs: number) => {
    setCurrentTimeMs(Math.max(0, Math.min(timeMs, durationMs)));
  }, [durationMs]);

  const seekToVerse = useCallback((verse: Verse) => {
    if (verse.alignment) {
      seekTo(verse.alignment.startMs + 50); // slight offset inside verse
    } else {
      seekTo((verse.orderIndex - 1) * 8000);
    }
  }, [seekTo]);

  const nextVerse = useCallback(() => {
    if (!poem) return;
    const nextIdx = activeVerseIndex + 1;
    if (nextIdx < poem.verses.length) {
      seekToVerse(poem.verses[nextIdx]);
    }
  }, [activeVerseIndex, poem, seekToVerse]);

  const prevVerse = useCallback(() => {
    if (!poem) return;
    const prevIdx = activeVerseIndex - 1;
    if (prevIdx >= 0) {
      seekToVerse(poem.verses[prevIdx]);
    } else {
      seekTo(0);
    }
  }, [activeVerseIndex, poem, seekToVerse, seekTo]);

  return {
    isPlaying,
    currentTimeMs,
    durationMs,
    playbackRate,
    volume,
    activeVerseIndex,
    activeVerse,
    togglePlay,
    seekTo,
    seekToVerse,
    nextVerse,
    prevVerse,
    setPlaybackRate,
    setVolume,
  };
}
