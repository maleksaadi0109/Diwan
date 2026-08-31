---
name: Arabic Poetry DB adapter transactions
description: How to do atomic multi-statement writes across the app's DatabaseAdapter implementations.
---

Use the database adapter's real transaction wrapper for any multi-statement write that must be atomic (e.g. moving a shared boundary between two adjacent records) — never a manual "apply, then compensate with an inverse write on failure" pattern.

**Why:** a compensating-write undo is not a real transaction — the undo write can itself fail, leaving a partial write behind. A real transaction guarantees all-or-nothing, including for in-memory/browser-fallback adapters that aren't backed by a real SQL engine.
