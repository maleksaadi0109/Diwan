import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Poem } from "@/types";
import { AudioController, AudioPlayerState } from "@/lib/audio/AudioController";
import { resolveAudioSrcAsync } from "@/lib/audio/fileManager";

interface AudioPlayerContextValue {
  controller: AudioController;
  playerState: AudioPlayerState;
  currentPoem: Poem | null;
  /** Sync the given poem's verses/audio into the shared controller. No-op (keeps playing) if the same track is already loaded. */
  loadPoem: (poem: Poem) => void;
  /** Stop playback and clear the currently loaded poem (used to dismiss the mini player). */
  clearPoem: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const controllerRef = useRef<AudioController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new AudioController();
  }
  const controller = controllerRef.current;

  const [playerState, setPlayerState] = useState<AudioPlayerState>(controller.getState());
  const [currentPoem, setCurrentPoem] = useState<Poem | null>(null);

  const lastLoadedPoemIdRef = useRef<string | null>(null);
  const lastLoadedAudioPathRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setPlayerState);
    return unsubscribe;
  }, [controller]);

  const loadPoem = useCallback(
    (poem: Poem) => {
      controller.setVerses(poem.verses);
      setCurrentPoem(poem);

      const defaultRec =
        poem.recordings.find((recording) => recording.id === poem.defaultRecordingId) ||
        poem.recordings[0];

      const lastAlignedEnd = poem.verses.reduce(
        (max, v) => (v.alignment ? Math.max(max, v.alignment.endMs) : max),
        0
      );
      const defaultDuration = defaultRec?.durationMs || lastAlignedEnd;
      const audioPath = defaultRec?.audioPath || "";
      const isNewPoemOrTrack =
        lastLoadedPoemIdRef.current !== poem.id ||
        lastLoadedAudioPathRef.current !== audioPath;

      if (!isNewPoemOrTrack) {
        // Same poem/track already loaded (e.g. navigating back to the
        // player while it keeps playing) -- verses were already re-synced
        // above, don't touch the audio element or reset playback.
        return;
      }

      const requestId = ++loadRequestIdRef.current;

      if (audioPath) {
        resolveAudioSrcAsync(audioPath).then((audioUrl) => {
          if (requestId !== loadRequestIdRef.current) return;
          lastLoadedPoemIdRef.current = poem.id;
          lastLoadedAudioPathRef.current = audioPath;
          controller.loadAudio(audioUrl, defaultDuration);
        });
      } else {
        lastLoadedPoemIdRef.current = poem.id;
        lastLoadedAudioPathRef.current = audioPath;
        controller.loadAudio("", defaultDuration);
      }
    },
    [controller]
  );

  const clearPoem = useCallback(() => {
    controller.pause();
    controller.setVerses([]);
    controller.loadAudio("");
    lastLoadedPoemIdRef.current = null;
    lastLoadedAudioPathRef.current = null;
    loadRequestIdRef.current += 1;
    setCurrentPoem(null);
  }, [controller]);

  const value: AudioPlayerContextValue = {
    controller,
    playerState,
    currentPoem,
    loadPoem,
    clearPoem,
  };

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayerContext(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayerContext must be used within an AudioPlayerProvider");
  }
  return ctx;
}
