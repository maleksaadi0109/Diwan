---
name: Offline Whisper model bundling
description: How to let faster-whisper skip the network entirely for a packaged desktop build.
---

faster-whisper's model loader only talks to the Hugging Face Hub when given
a model name/ID. Passed an existing local directory instead, it loads
straight from disk with zero network calls.

**Why:** first-run transcription otherwise requires downloading a large
model, which fails outright on a machine with no internet or a flaky one.
Bundling a pre-converted model as a packaged resource and pointing the
loader at that local directory removes the network dependency for first
run, without touching the existing download-and-cache path used everywhere
the resource isn't bundled (dev, other platforms, a build that skipped the
bundling step).

**How to apply:** any offline-capable desktop packaging effort for a model-
or asset-heavy dependency should follow the same shape already used for
bundling other platform binaries in this project: resolve a bundled
resource path, pass it into the spawned process via an env var, prefer it
over the remote name when present, and gate the packaging build so it
fails loudly (not silently) when the expected bundled resource is missing
— a purely manual "remember to copy this file" step is not durable.
