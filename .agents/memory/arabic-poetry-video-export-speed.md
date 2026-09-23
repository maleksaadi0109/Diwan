---
name: Desktop video export speed
description: Why Windows desktop video export may lag the recording and when a different export architecture is needed.
---

The current canvas/MediaRecorder export is constrained to real-time audio
playback: even if encoding is made efficient, a two-minute recording cannot
export in less than about two minutes with this pipeline. On Windows WebView2,
preferring VP9 and drawing a full-HD canvas at a higher rate than capture can
make it take substantially longer than the audio.

**Why:** The reported Windows case took roughly five minutes for a two-minute
recording, while Linux had felt faster. A Windows-specific, lighter encoding
profile can reduce overload without changing other platforms, but it is not
an offline renderer.

**How to apply:** If users need faster-than-real-time export, do not try to
speed up HTML audio during MediaRecorder capture: that changes output timing.
Design an offline frame/audio encoding path instead. For ordinary performance
work, verify actual elapsed time on Windows separately from the recording
duration and the final save step before claiming a measured speedup.