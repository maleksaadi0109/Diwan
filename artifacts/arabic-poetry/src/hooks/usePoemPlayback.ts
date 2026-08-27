import { useState, useEffect, useRef, useCallback } from "react";
import { Poem, Verse } from "@/types";
import { AudioController, AudioPlayerState } from "@/lib/audio/AudioController";
import { resolveAudioSrc } from "@/lib/audio/fileManager";

export function usePoemPlayback(poem: Poem | null) {
  const controllerRef = useRef<AudioController | null>(null);

  // Initialize controller once
  if (!controllerRef.current) {
    controllerRef.current = new AudioController();
  }

  const controller = controllerRef.current;

  const [playerState, setPlayerState] = useState<AudioPlayerState>(controller.getState());
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync verses with controller whenever poem or its verses change
  useEffect(() => {
    if (poem) {
      controller.setVerses(poem.verses);
      const defaultRec =
        poem.recordings.find((recording) => recording.id === poem.defaultRecordingId) ||
        poem.recordings[0];
      const audioUrl = defaultRec ? resolveAudioSrc(defaultRec.audioPath) : "";
      const defaultDuration = defaultRec?.durationMs || (poem.verses.length * 8000);
      controller.loadAudio(audioUrl, defaultDuration);
    } else {
      controller.setVerses([]);
      controller.loadAudio("");
    }
  }, [poem, controller]);

  // Subscribe to controller state changes (guaranteed single subscriber per hook instance)
  useEffect(() => {
    const unsubscribe = controller.subscribe((state) => {
      setPlayerState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [controller]);

  // Clean up controller when component unmounts
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // User scrolling detection to avoid fighting manual scroll
  const handleUserScroll = useCallback(() => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    // Resume auto-scrolling 3 seconds after user stops scrolling
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000);
  }, []);

  const togglePlay = useCallback(() => controller.togglePlay(), [controller]);
  const play = useCallback(() => controller.play(), [controller]);
  const pause = useCallback(() => controller.pause(), [controller]);
  const seekTo = useCallback((timeMs: number) => controller.seekTo(timeMs), [controller]);
  const seekToVerse = useCallback((verse: Verse) => {
    setIsUserScrolling(false);
    controller.seekToVerse(verse);
  }, [controller]);
  const nextVerse = useCallback(() => {
    setIsUserScrolling(false);
    controller.nextVerse();
  }, [controller]);
  const prevVerse = useCallback(() => {
    setIsUserScrolling(false);
    controller.prevVerse();
  }, [controller]);
  const setPlaybackRate = useCallback((rate: number) => controller.setPlaybackRate(rate), [controller]);
  const setVolume = useCallback((vol: number) => controller.setVolume(vol), [controller]);
  const toggleMute = useCallback(() => controller.toggleMute(), [controller]);

  // Keyboard shortcut handler (Space, Arrows, J/K/L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          prevVerse(); // In RTL, right arrow navigates backward
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextVerse(); // In RTL, left arrow navigates forward
          break;
        case "KeyJ":
          e.preventDefault();
          seekTo(Math.max(0, playerState.currentTimeMs - 5000));
          break;
        case "KeyL":
          e.preventDefault();
          seekTo(Math.min(playerState.durationMs, playerState.currentTimeMs + 5000));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, prevVerse, nextVerse, seekTo, playerState.currentTimeMs, playerState.durationMs]);

  return {
    ...playerState,
    isUserScrolling,
    handleUserScroll,
    togglePlay,
    play,
    pause,
    seekTo,
    seekToVerse,
    nextVerse,
    prevVerse,
    setPlaybackRate,
    setVolume,
    toggleMute,
  };
}
