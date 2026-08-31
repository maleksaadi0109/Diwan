---
name: Tauri v2 fs capability scoping
description: How to grant a destructive fs permission (e.g. remove) without inheriting the app's broad wildcard scope.
---

When adding a new Tauri `fs:allow-*` permission (especially destructive ones like `remove`), do not just add the bare permission string if the capability file already has a broad `fs:scope` (e.g. `**`) shared by other permissions — that combination lets frontend JS use the new command on any path the broad scope covers, not just the directory the feature actually needs.

**Why:** code review rejected a diagnostics feature that added `fs:allow-remove` bare into a capability whose existing `fs:scope` included `**`; it graded as unrestricted arbitrary-file-deletion capability, even though the feature only ever deleted one file under the app-data directory.

**How to apply:** grant the specific permission as a scoped object instead of a bare string, e.g. `{ "identifier": "fs:allow-remove", "allow": [{ "path": "$APPDATA/**" }] }`, so its own scope stays narrow even when a separate, broader `fs:scope` permission also exists in the same capability for other (safer) commands.
