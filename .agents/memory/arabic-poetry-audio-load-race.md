---
name: Async audio load/play race + browser duration-probe seek
description: Two related playback glitches in the Arabic Poetry player -- an async load/play race, and the browser's internal "probe seek" for files without a reliable duration header.
---

## Async load/play race
Never call `controller.play()` right after `loadPoem()`/`loadAudio()` without waiting for the async `src` resolution (e.g. `resolveAudioSrcAsync`). Pass an `autoplay` option through so play only fires once the real source is set, otherwise play() can target the previous (or no) source.

## Browser duration-probe seek ("jump to end, then snap back to start")
Some browser media engines can't determine a file's exact duration from its container headers alone (common for re-encoded/trimmed MP3s) and internally seek to a huge/implausible timestamp to discover the real length, then seek back to the actual position -- firing `seeking`/`timeupdate` with the bogus large value in between.

**Why this matters here:** the player's `AudioController` reacted to every `currentTime` reading, including this transient bogus one, which briefly highlighted/reported the *last* verse before snapping back to the first -- exactly the "plays briefly, jumps to the end, then returns to the first verse" symptom reported by the user for YouTube-imported (trimmed) recordings specifically.

**How to apply:** any code reading `audio.currentTime` for UI/sync purposes should discard readings that are implausible given the known duration (e.g. `currentMs > durationMs + toleranceMs`, or negative/non-finite), rather than trusting every raw reading. See `AudioController.isImplausibleProbeReading` for the guard. Also worth doing defensively: validate that a trimmed/re-encoded audio file's real decoded duration matches the expected post-trim duration before serving it, in case the encode step itself produced a corrupt/mismatched file (see `trim_leading_silence`'s sanity check in `worker/diwan_worker/audio/youtube.py`).
