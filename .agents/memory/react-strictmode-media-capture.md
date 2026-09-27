---
name: StrictMode media-capture lifecycle
description: React development lifecycle behavior that can silently disable asynchronous microphone or camera startup.
---

Any mounted-state ref guarding asynchronous media capture must be set to `true` inside the effect setup and set to `false` in cleanup.

**Why:** React StrictMode runs an extra setup/cleanup cycle in development. A ref initialized to `true` only at declaration can remain `false` after that check, causing later `getUserMedia` results to be discarded and their tracks stopped without a visible error.

**How to apply:** Use this pattern in microphone, camera, screen-capture, and other async resource hooks that check whether the component is still mounted before accepting a resolved resource.