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

The packaging gate must cover every model size that import flows actually
request, not only the worker client's default. A missing size silently
switches a bundled offline build to a network download, and a subsequent
native-library crash can look like a network problem.

**Why:** A Windows import requested `tiny` while only `small` was bundled;
the worker unexpectedly contacted Hugging Face before crashing on model load.

**How to apply:** When changing a hard-coded import model or packaging policy,
check both the import callers and the bundle's fetch/verification list. Keep
each needed size pinned and present in the Windows resources.

A lower-level optional default alone is not a reason to ship a large unused
model. Align that default with the active transcription flows and limit the
resource mapping to the selected model's subfolder, rather than a parent
directory that may contain stale models from earlier builds.

**Why:** Including both `tiny` and `small` to cover an unused default inflated
the Windows installer. Changing the download gate alone would not help
existing builders if the resource mapping still packaged their old `small`
folder.

**How to apply:** When trimming bundled models, check live call sites,
fallback defaults, preparation gates, and resource mapping together. Do not
automatically delete previously downloaded model files from users' machines.
