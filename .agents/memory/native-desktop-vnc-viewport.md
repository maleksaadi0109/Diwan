---
name: Native desktop VNC viewport
description: How to interpret a cropped Tauri desktop window in Replit's VNC view.
---

Treat a clipped native window as a display-resolution issue before changing the app's layout.

**Why:** Replit's VNC display initially opened at 800×600 while the native window had a larger minimum width; the application was healthy but its right edge was off-screen. A larger virtual resolution exposed the full window.

**How to apply:** When native GUI screenshots show only part of the window, compare the VNC display size with the window geometry and set the virtual display mode as part of the desktop launch. The browser preview can look correct while the native window is clipped.

The managed web preview and Tauri's development launcher can compete for the same Vite port when both run at once.

**Why:** Tauri's before-dev server then fails with "Port is already in use", even though the existing preview server is healthy. This is a process conflict, not a broken desktop build.

**How to apply:** For native screenshots, reuse the already-running Vite server with the compiled desktop binary when available, or briefly stop the competing preview workflow and restore it afterward. Do not change application ports merely to work around simultaneous preview sessions.