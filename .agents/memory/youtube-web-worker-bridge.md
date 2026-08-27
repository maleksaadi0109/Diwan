---
name: YouTube web worker bridge
description: Why the Arabic poetry web preview needs an API bridge for YouTube and how the native Tauri path differs.
---

The browser preview cannot invoke the Tauri Python worker. YouTube metadata and downloads in web mode must call the API server, which spawns the same Python worker and serves the generated MP3/WAV paths through the Vite proxy. Native Tauri continues to use IPC directly.

**Why:** Returning simulated download metadata in the browser made the UI report success without creating any audio files.

**How to apply:** Keep the API server workflow running with the Arabic poetry web preview, and preserve the raw-download → FFprobe → MP3/WAV conversion sequence in the Python worker.