---
name: api-server YouTube audio path prefix quirk
description: Why /api/youtube/download response paths need rewriting before use as a URL, and why they must NOT be rewritten before use as /api/align's audio_path.
---

`artifacts/api-server`'s `/youtube/download` and `/align` routes (`artifacts/api-server/src/routes/youtube.ts`) return/expect audio paths prefixed `/api-worker/youtube/audio/<jobId>/<file>`. That prefix is a holdover from the desktop web app's Vite dev-proxy rewrite (`/api-worker` -> `/api`) and does NOT exist as a real server route.

**Two different uses, two different rules:**
- To actually fetch/stream the audio (e.g. mobile `expo-audio` player source), replace the leading `/api-worker/` with `/api/` and prepend the domain — only then does it resolve to the real `GET /api/youtube/audio/:jobId/:fileName` route.
- To call `/api/align`'s `audio_path` field, pass the path **exactly as returned** from `/download` (still `/api-worker/...`) — the server's `resolveDownloadedAudioPath` validates against that literal prefix via regex and rejects anything else.

**Why:** Found while wiring the mobile app (`artifacts/mobile`) to reuse the existing api-server pipeline without modifying it (constraint: don't change api-server). Mixing up the two uses causes either a 404 (wrong fetch URL) or `INVALID_AUDIO_PATH` (wrong align payload).

**How to apply:** See `artifacts/mobile/lib/api.ts`'s `toPlayableAudioUrl()` for the fetch-URL conversion; the import flow (`artifacts/mobile/app/(tabs)/import.tsx`) passes `download.processing_audio_path` untouched to `/align`.

Also: the mobile app streams audio directly from this transient server folder rather than downloading it locally — acceptable for v1, but means imported poems stop playing if the api-server clears `.data/diwan-youtube` (tracked as a follow-up task).
