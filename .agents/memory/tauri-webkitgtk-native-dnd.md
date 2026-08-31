---
name: Native HTML5 drag-and-drop unreliable in Tauri desktop webview
description: Mouse drag-to-reorder built with the HTML5 DnD API (draggable/onDragStart/onDragOver/onDrop) can silently fail to fire in Tauri's WebKitGTK desktop webview even though it works fine in a normal browser preview.
---

## Symptom
A drag-to-reorder list (e.g. playlist reordering) works in the web preview but does nothing (or nothing visible) when dragging with the mouse in the Tauri desktop build.

**Why:** Tauri's Linux desktop webview (WebKitGTK) has known reliability gaps with the native HTML5 Drag and Drop API (`draggable` attribute + `dragstart`/`dragover`/`drop` events) — events can fail to fire consistently, unlike a full browser (Chrome/Firefox) or the web preview.

## How to apply
Prefer a manual pointer-based drag implementation over native HTML5 DnD for any reorder/drag interaction that must work in a Tauri desktop build:
- Use the Pointer Events API (`onPointerDown` + `setPointerCapture`, `onPointerMove`, `onPointerUp`/`onPointerCancel`) on a dedicated drag handle.
- On move, use `document.elementFromPoint(clientX, clientY)` plus a `data-*` index attribute on each row (via `.closest()`) to determine the current drop target, since pointer-captured events keep firing on the origin element regardless of where the cursor visually is.
- Add `touch-action: none` (Tailwind `touch-none`) on the handle so touch drags don't also trigger scrolling.
- This approach works identically across browser preview, Tauri desktop, and touch — no separate code path needed per platform.

See `artifacts/arabic-poetry/src/features/playlists/PlaylistDetailView.tsx` for a reference implementation (handle-driven pointer capture drag).
