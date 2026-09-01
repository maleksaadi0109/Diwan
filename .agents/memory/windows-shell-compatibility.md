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

Reconfiguring `sys.stdout`/`sys.stderr` inside the Python process is not
enough on Windows: a third-party library (e.g. yt-dlp) or an uncaught
exception can still write straight to the original text stream before that
reconfiguration takes effect, or through a code path we didn't patch,
re-triggering `'charmap' codec can't encode character ...`.

**Why:** the interpreter builds `sys.stdout`/`stderr` at startup using the
console's legacy codepage with strict error handling; anything that runs
before or around our in-process patch still hits that original wrapper.

**How to apply:** set `PYTHONIOENCODING=utf-8:backslashreplace` and
`PYTHONUTF8=1` as environment variables on the *parent* process before
spawning the Python worker (e.g. in the Rust `Command`), so the interpreter
itself starts in UTF-8 mode with non-fatal encoding errors — this covers
every writer, not just the ones we've explicitly reconfigured.