import { useState, useEffect, useRef, useCallback } from "react";
import { Poem, Verse } from "@/types";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";

export function usePoemPlayback(poem: Poem | null) {
  const { controller, playerState, loadPoem } = useAudioPlayerContext();

  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync verses/audio with the shared controller whenever this poem is
  // opened. `loadPoem` is a no-op on the audio element if the same
  // poem/track is already loaded (e.g. resuming from the mini player), so
  // playback is never interrupted.
  useEffect(() => {
    if (poem) {
      loadPoem(poem);
    }
  }, [poem, loadPoem]);

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
