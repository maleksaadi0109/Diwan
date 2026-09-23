---
name: Recording placeholders
description: Some seeded desktop poems include recording metadata without playable audio bytes.
---

Treat a recording as usable only when it has a non-empty, resolvable audio path. A recording title and duration alone do not prove that playback or export can work.

**Why:** Seeded catalog entries can contain descriptive recording placeholders whose audio path is empty. A selector that accepts them appears complete but fails as soon as playback starts.

**How to apply:** For any desktop feature that consumes audio, filter or clearly label placeholders and provide a way to select a real local audio file when no playable recording exists.