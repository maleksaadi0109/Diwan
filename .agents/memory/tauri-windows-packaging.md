---
name: Tauri per-platform config overrides
description: How to bundle platform-only resources (e.g. a frozen worker executable, native binaries) without affecting other platforms' builds.
---

Tauri v2 supports a platform-specific config override file, `src-tauri/tauri.<platform>.conf.json` (e.g. `tauri.windows.conf.json`), which merges on top of the base `tauri.conf.json` only when building for that platform.

**Why:** some bundled resources (a frozen interpreter/worker executable, platform-native binaries) only make sense — and only exist — on one target platform. Putting them in the base config would require every platform's build to have those files present, or fail.

**How to apply:** put platform-only `bundle.resources` / `bundle.externalBin` entries in the override file, not the base config. Code that consumes a platform-only bundled resource at runtime must still resolve it defensively (treat "resource missing" as a normal case, not an error) so dev builds and other platforms keep working unchanged.
