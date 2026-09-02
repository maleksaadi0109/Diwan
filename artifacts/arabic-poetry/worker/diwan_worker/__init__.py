"""Diwan audio processing and speech alignment worker."""

import sys

# Ensure UTF-8 standard streams on Windows across all worker modules & imports
for stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(
                encoding="utf-8",
                errors="strict" if stream is sys.stdin else "backslashreplace",
            )
    except (AttributeError, OSError, ValueError):
        pass

__version__ = "0.1.0"
