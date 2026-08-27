# Arabic Poetry Desktop / ديوان الشعر العربي

React/Vite preview and Tauri desktop application for reading Arabic poetry, importing verified poem text, and synchronizing recitations with verses.

## Run & Operate

- `pnpm --filter @workspace/arabic-poetry run dev` — run the Arabic poetry web preview on port 23461
- `pnpm --filter @workspace/arabic-poetry run typecheck` — typecheck the imported desktop frontend
- `pnpm --filter @workspace/arabic-poetry run build` — build the web frontend to `artifacts/arabic-poetry/dist/public`
- `PYTHONPATH=artifacts/arabic-poetry/worker python3 -m pytest -q artifacts/arabic-poetry/worker/tests` — test the audio worker
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/arabic-poetry/src/` — React application, import flows, player, database adapters, alignment UI, and providers
- `artifacts/arabic-poetry/src/lib/providers/MizanAlArabProvider.ts` — Mizan Al-Arab API parsing and background explanation enrichment
- `artifacts/arabic-poetry/src/lib/worker/workerClient.ts` — Tauri IPC and browser-safe worker client
- `artifacts/arabic-poetry/worker/diwan_worker/` — Python audio inspection, conversion, VAD, ASR, alignment, and YouTube pipeline
- `artifacts/arabic-poetry/worker/diwan_worker/audio/youtube.py` — YouTube metadata/download pipeline and structured Arabic errors
- `artifacts/arabic-poetry/src-tauri/` — Tauri 2 shell, SQLite plugin, filesystem/dialog plugins, and Python worker bridge
- `artifacts/arabic-poetry/src/styles/globals.css` — dark parchment/gold visual theme and Tailwind v4 theme tokens

## Architecture decisions

- Preserve the original Arabic text and diacritics; only derived normalized text is used for matching.
- Save poem text before explanation enrichment so a Mizan outage cannot block import; explanations are fetched in the background.
- Download YouTube audio as the raw source first, then create and validate separate `playback.mp3` and `processing.wav` files with FFprobe.
- Use `requestAnimationFrame` and binary-search verse boundaries for playback highlighting; VAD is supporting evidence for ASR alignment, not a standalone boundary detector.
- Keep the web preview functional with an in-memory database; Tauri uses SQLite when the native runtime is available.

## Product

The app includes a seeded Arabic poetry library, synchronized verse player, manual poem/audio import, Mizan Al-Arab import with metadata and full verse text, YouTube audio import, transcription/alignment tooling, boundary review, dictionary lookup, and export UI.

## User preferences

No cross-project preferences recorded.

## Gotchas

- The Tauri worker requires `python3`, `yt-dlp`, `ffmpeg`, and `ffprobe` to be available in the packaged/runtime environment.
- The web preview cannot invoke Tauri IPC; worker client functions intentionally provide browser-safe fallbacks, while native downloading and ASR run through Tauri.
- Mizan browser requests use the Vite `/api-mizan` proxy to avoid browser CORS restrictions.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
