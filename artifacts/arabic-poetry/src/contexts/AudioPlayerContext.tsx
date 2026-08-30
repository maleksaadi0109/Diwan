import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Poem, RepeatMode } from "@/types";
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
  /** Load a playlist's poems into the playback queue and start playing at the given index. */
  loadQueue: (poems: Poem[], startIndex?: number, playlistId?: string) => void;
  /** Id of the playlist currently loaded into the queue, if any. */
  activePlaylistId: string | null;
  queue: Poem[];
  queueIndex: number;
  hasQueue: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  playNextInQueue: () => void;
  playPreviousInQueue: () => void;
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
  const [queue, setQueue] = useState<Poem[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  const lastLoadedPoemIdRef = useRef<string | null>(null);
  const lastLoadedAudioPathRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);

  // Mirror the latest queue state in refs so the "ended" effect below can
  // read up-to-date values without re-subscribing on every state change.
  const queueRef = useRef<Poem[]>([]);
  const queueIndexRef = useRef(-1);
  const shuffleRef = useRef(false);
  const repeatModeRef = useRef<RepeatMode>("off");
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setPlayerState);
    return unsubscribe;
  }, [controller]);

  const loadPoem = useCallback(
    (poem: Poem, options?: { fromQueue?: boolean; autoplay?: boolean }) => {
      if (!options?.fromQueue) {
        // Loading a poem outside of queue navigation (e.g. opening it
        // directly from the library) exits any active playlist queue.
        setQueue([]);
        setQueueIndex(-1);
        setActivePlaylistId(null);
      }
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
        if (options?.autoplay) controller.play();
        return;
      }

      const requestId = ++loadRequestIdRef.current;

      if (audioPath) {
        resolveAudioSrcAsync(audioPath).then((audioUrl) => {
          if (requestId !== loadRequestIdRef.current) return;
          lastLoadedPoemIdRef.current = poem.id;
          lastLoadedAudioPathRef.current = audioPath;
          controller.loadAudio(audioUrl, defaultDuration);
          if (options?.autoplay) controller.play();
        });
      } else {
        lastLoadedPoemIdRef.current = poem.id;
        lastLoadedAudioPathRef.current = audioPath;
        controller.loadAudio("", defaultDuration);
        if (options?.autoplay) controller.play();
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
    setQueue([]);
    setQueueIndex(-1);
    setActivePlaylistId(null);
  }, [controller]);

  const loadQueue = useCallback(
    (poems: Poem[], startIndex: number = 0, playlistId?: string) => {
      if (poems.length === 0) return;
      const safeIndex = Math.min(Math.max(startIndex, 0), poems.length - 1);
      setQueue(poems);
      setQueueIndex(safeIndex);
      setActivePlaylistId(playlistId || null);
      loadPoem(poems[safeIndex], { fromQueue: true, autoplay: true });
    },
    [loadPoem]
  );

  const goToQueueIndex = useCallback(
    (index: number, autoplay: boolean) => {
      const currentQueue = queueRef.current;
      if (currentQueue.length === 0) return;
      setQueueIndex(index);
      loadPoem(currentQueue[index], { fromQueue: true, autoplay });
    },
    [loadPoem]
  );

  const playNextInQueue = useCallback(() => {
    const currentQueue = queueRef.current;
    if (currentQueue.length === 0) return;
    const currentIndex = queueIndexRef.current;

    if (shuffleRef.current && currentQueue.length > 1) {
      let nextIndex = currentIndex;
      while (nextIndex === currentIndex) {
        nextIndex = Math.floor(Math.random() * currentQueue.length);
      }
      goToQueueIndex(nextIndex, true);
      return;
    }

    let nextIndex = currentIndex + 1;
    if (nextIndex >= currentQueue.length) {
      if (repeatModeRef.current === "all") {
        nextIndex = 0;
      } else {
        return; // End of queue, nothing left to play.
      }
    }
    goToQueueIndex(nextIndex, true);
  }, [goToQueueIndex]);

  const playPreviousInQueue = useCallback(() => {
    const currentQueue = queueRef.current;
    if (currentQueue.length === 0) return;
    const currentIndex = queueIndexRef.current;

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = repeatModeRef.current === "all" ? currentQueue.length - 1 : 0;
    }
    goToQueueIndex(prevIndex, true);
  }, [goToQueueIndex]);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => !s);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);

  // Auto-advance when the current track finishes playing.
  useEffect(() => {
    if (playerState.status !== "ended") return;
    if (queueRef.current.length === 0) return;

    if (repeatModeRef.current === "one") {
      controller.seekTo(0);
      controller.play();
      return;
    }
    playNextInQueue();
  }, [playerState.status, controller, playNextInQueue]);

  const value: AudioPlayerContextValue = {
    controller,
    playerState,
    currentPoem,
    loadPoem,
    clearPoem,
    loadQueue,
    activePlaylistId,
    queue,
    queueIndex,
    hasQueue: queue.length > 0,
    shuffle,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
    playNextInQueue,
    playPreviousInQueue,
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
