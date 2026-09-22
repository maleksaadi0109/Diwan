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

This repository requires pnpm because the workspace uses the `catalog:` dependency protocol.

## Replit preview scope

The Replit preview runs the React/Vite interface. Native capabilities provided by Tauri, Rust, local SQLite, the filesystem, FFmpeg, and the Python transcription worker require the desktop runtime and are not available in the browser-only preview.

For full desktop development, follow `artifacts/arabic-poetry/README.md`.

## Product scope

User-requested features target the desktop app in `artifacts/arabic-poetry` only. Do not port them to or modify `artifacts/mobile` unless the user explicitly asks for mobile work.