---
name: Global audio player context (Arabic Poetry Desktop)
description: Why audio playback state was lifted from a per-view hook into an App-level React context, for a persistent mini-player.
---

Audio playback (the `AudioController` instance, its `AudioPlayerState`, and the currently loaded poem) lives in a single `AudioPlayerProvider` (`src/contexts/AudioPlayerContext.tsx`) mounted once at the top of `App`, not inside `usePoemPlayback` per-component. `usePoemPlayback(poem)` is now a thin wrapper around this shared context; it calls `loadPoem(poem)` on mount/poem-change, which is a no-op on the actual `<audio>` element if the same poem/track is already loaded.

**Why:** Before this, every `usePoemPlayback` call created its own `AudioController` + `<audio>` element scoped to that component instance (player view, editor view). Playback died the instant the owning view unmounted (e.g. navigating from the player back to the library), which made a persistent "now playing" mini-player impossible — there was no stable owner of playback state to read from elsewhere in the tree.

**How to apply:** Any new view that needs to read or control playback (mini-player, now-playing indicators, global keyboard shortcuts, etc.) should consume `useAudioPlayerContext()` directly, or go through `usePoemPlayback`. Don't reintroduce a component-local `AudioController` — it will fork playback state and break the mini-player/continuity guarantee. If a new poem is opened while another is still loaded, `loadPoem` intentionally swaps the shared controller to the new poem (stops the old one) — this is deliberate, matching typical single-track music-player UX.
