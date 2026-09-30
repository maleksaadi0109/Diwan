# Diwan on Replit

## Run

The `Start application` workflow launches the browser-accessible React frontend:

```bash
PORT=5000 pnpm --filter @workspace/arabic-poetry run dev
```

Install workspace dependencies from the repository root with:

```bash
pnpm install --frozen-lockfile
```

Use pnpm, not npm: workspace dependencies use the `catalog:` protocol.

For the native Tauri application, start the optional `Diwan desktop` workflow and open its desktop/VNC view. Its first Rust build can take several minutes. The workflow sets the virtual screen resolution and Linux library paths needed by Tauri and the Python audio worker. If Python dependencies need restoring, run `uv sync --python 3.13 --frozen` from the repository root.

## Preview scope

The web preview displays the React/Vite interface. Tauri commands, local SQLite, native filesystem access, FFmpeg, and the Python transcription worker require the native desktop runtime and do not run in the browser preview. See `artifacts/arabic-poetry/README.md` for more details.

## Product scope

User-requested features target the desktop app in `artifacts/arabic-poetry` only. Do not port them to or modify `artifacts/mobile` unless the user explicitly asks for mobile work.
