---
name: Async audio load/play race in AudioPlayerContext
description: loadPoem resolves audio src asynchronously; calling controller.play() right after loadPoem() without awaiting can fire before the src is set.
---

When `loadPoem(poem)` needs to resolve a file path via `resolveAudioSrcAsync` (async), calling `controller.play()` immediately after `loadPoem()` races the async resolution and fails silently (console: "audio element or src missing").

**Why:** loadPoem's audio-loading branch is async (promise `.then()`), but the function itself returns synchronously before that promise settles. Any caller that combines "load a track" + "autoplay it" (e.g. a playback queue advancing to the next track) must not call play() right after invoking loadPoem.

**How to apply:** loadPoem takes an `{ autoplay?: boolean }` option and calls `controller.play()` itself, inside the async resolution callback (and in the sync "no audio path" branch, and in the "already loaded, same track" early-return branch). Callers that need autoplay (queue/playlist next-track, initial queue load) pass `{ autoplay: true }` instead of calling `controller.play()` externally.
