---
name: Windows shell compatibility
description: Cross-platform package scripts must not assume Unix shell syntax.
---

Workspace lifecycle and development scripts run under different shells on different platforms. Avoid `sh -c`, inline `NAME=value command`, and other Unix-only syntax in package scripts; use a Node launcher when behavior or environment setup must be portable.

**Why:** Windows PowerShell and cmd.exe do not interpret Unix environment assignments or guarantee a `sh` executable, so otherwise-correct installs and development commands fail before the application starts.

**How to apply:** Keep platform-specific environment setup inside a small Node script that detects `process.platform`, then spawns the actual CLI with inherited environment and stdio.

Python workers communicating over Windows pipes should explicitly configure
stdin/stdout/stderr as UTF-8; video titles, descriptions, and progress
messages can contain emoji that the legacy Windows `charmap` codec cannot
encode.

**Why:** the worker's machine-readable JSON channel must carry the same
Arabic and Unicode metadata on Windows as it does on Linux.

**How to apply:** configure the streams before entering the worker request
loop, using a lossless UTF-8 input mode and a safe output error handler.