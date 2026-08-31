import { Poem } from "@/types";

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSeekTo?: (timeSeconds: number) => void;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
}

/**
 * Synchronizes the current poem and playback status with the OS MediaSession API.
 * This provides system-level media controls, lock screen controls, multimedia keyboard keys,
 * and background playback controls across Windows, macOS, Linux, Android, and iOS.
 */
export class SystemMediaSessionManager {
  private static isSupported(): boolean {
    return typeof navigator !== "undefined" && "mediaSession" in navigator;
  }

  /**
   * Updates OS media metadata with poem details
   */
  static updateMetadata(poem: Poem | null) {
    if (!this.isSupported() || !poem) return;

    try {
      const artwork = poem.coverImageUrl
        ? [{ src: poem.coverImageUrl, sizes: "512x512", type: "image/jpeg" }]
        : [{ src: "/favicon.svg", sizes: "128x128", type: "image/svg+xml" }];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: poem.title,
        artist: poem.poet.name,
        album: `ديوان الشعر العربي (${poem.era})`,
        artwork,
      });
    } catch (err) {
      console.warn("MediaSession metadata update failed:", err);
    }
  }

  /**
   * Updates playback state ('playing' | 'paused' | 'none')
   */
  static updatePlaybackState(isPlaying: boolean) {
    if (!this.isSupported()) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch {
      // Ignore unsupported browsers
    }
  }

  /**
   * Updates position state in OS media timeline
   */
  static updatePositionState(currentTimeMs: number, durationMs: number, playbackRate = 1.0) {
    if (!this.isSupported() || !navigator.mediaSession.setPositionState) return;
    try {
      if (durationMs > 0 && currentTimeMs >= 0) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(durationMs / 1000, 0.1),
          playbackRate: Math.max(playbackRate, 0.25),
          position: Math.min(currentTimeMs / 1000, durationMs / 1000),
        });
      }
    } catch {
      // Ignore position state errors
    }
  }

  /**
   * Registers media action handlers for background and media key controls
   */
  static registerHandlers(handlers: MediaSessionHandlers) {
    if (!this.isSupported()) return () => {};

    const actions: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ["play", handlers.onPlay ? () => handlers.onPlay!() : null],
      ["pause", handlers.onPause ? () => handlers.onPause!() : null],
      ["nexttrack", handlers.onNext ? () => handlers.onNext!() : null],
      ["previoustrack", handlers.onPrevious ? () => handlers.onPrevious!() : null],
      [
        "seekto",
        handlers.onSeekTo
          ? (details) => {
              if (details.seekTime !== undefined && details.seekTime !== null) {
                handlers.onSeekTo!(details.seekTime);
              }
            }
          : null,
      ],
      ["seekforward", handlers.onSeekForward ? () => handlers.onSeekForward!() : null],
      ["seekbackward", handlers.onSeekBackward ? () => handlers.onSeekBackward!() : null],
    ];

    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions might not be supported on all OS platforms
      }
    }

    return () => {
      if (!this.isSupported()) return;
      for (const [action] of actions) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore unregister errors
        }
      }
    };
  }
}
