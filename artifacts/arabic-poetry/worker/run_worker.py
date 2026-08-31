"""Package-safe entry point for the frozen Windows worker executable.

`diwan_worker/cli.py` uses package-relative imports (`from . import
__version__`, `from .schemas.protocol import ...`), so it cannot be run
directly as a script/`__main__` module -- doing so raises `ImportError:
attempted relative import with no known parent package` under both a
plain interpreter and PyInstaller (which runs its configured script entry
as `__main__` too). Importing `diwan_worker.cli` as a normal package
submodule from this top-level launcher instead keeps the package context
intact, so this is the entry point PyInstaller must target
(`diwan_worker.windows.spec`), not the module file itself.

For dev/non-frozen use, nothing changes: `python -m diwan_worker.cli` (used
by the Tauri host) already imports the module as part of its package and is
unaffected by this file.
"""
from diwan_worker.cli import main

if __name__ == "__main__":
    main()
