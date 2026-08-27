# Arabic Poetry Desktop — Step-by-Step Instructions for Antigravity CLI AI

This guide is designed to be pasted into an AI coding CLI one phase at a time. Do **not** ask the agent to build the entire application in one prompt. Each phase has a prompt, acceptance criteria, and a checkpoint.

## 0. Important architecture correction

Build the first usable version with this stack:

- Tauri 2
- React + TypeScript + Vite
- Tailwind CSS
- SQLite through a Tauri plugin
- Python worker for audio processing and speech recognition
- `ffmpeg` for audio conversion and segmentation
- `yt-dlp` only for media the user has the right to download
- `faster-whisper` or WhisperX for Arabic speech recognition with word timestamps
- A semi-global dynamic-programming aligner for mapping transcript words to poem words

Energy-based VAD alone cannot align spoken Arabic to written verses. It can remove silence, but accurate verse timestamps require an Arabic ASR transcript with word timestamps. Use VAD + ASR + text alignment.

Do not depend on undocumented Mizan Al-Arab endpoints until they are tested. Create a provider interface and include manual poem entry/import as the reliable fallback. Respect site terms, copyright, API limits, and YouTube’s terms.

---

## 1. Master prompt

Paste this first:

```text
You are the lead engineer for a production-quality cross-platform desktop application named "Diwan — ديوان الشعر العربي".

Goal:
Create a Tauri 2 desktop app that imports an Arabic poem and a legally accessible recitation audio file, transcribes the Arabic audio with word timestamps, aligns the transcript to poem verses, and displays synchronized RTL verses during playback. A user can click a verse to seek, inspect confidence, edit its boundaries, and read meter, explanation, and vocabulary when available.

Engineering rules:
1. Work incrementally. Complete only the requested phase.
2. Before editing, inspect the repository and explain the plan briefly.
3. After editing, run formatting, type checking, tests, and the relevant build.
4. Never claim a feature works unless its test or manual verification succeeds.
5. Do not invent third-party API endpoints. Put external sources behind typed provider interfaces and use fixtures/mocks in tests.
6. Keep secrets out of source control. Add .env.example only when needed.
7. Use strict TypeScript and explicit Python type hints.
8. Keep the UI Arabic-first, RTL, keyboard accessible, and usable offline.
9. Record important decisions and setup commands in README.md.
10. At the end of each phase report:
   - files changed
   - commands run
   - test/build results
   - known limitations
   - exact next recommended phase

Do not implement anything yet. Inspect the environment and report whether Node, npm, Rust, Cargo, Python, ffmpeg, and Tauri prerequisites are installed. Then propose the minimum commands needed to initialize the project.
```

Checkpoint: verify the CLI reports real versions and does not start coding yet.

---

## 2. Phase 1 — Scaffold the desktop app

```text
Implement Phase 1 only: scaffold the desktop application.

Requirements:
- Tauri 2 + React + TypeScript + Vite.
- Tailwind CSS using the currently supported Vite setup.
- App name: Diwan.
- Arabic RTL document layout.
- Fonts: Amiri for poetry and Cairo for controls, with sensible local fallbacks.
- Dark visual system: charcoal background, warm parchment surfaces, amber/gold accent.
- Create routes or top-level views for Library, Poem Player, Import, and Settings.
- Use mock data only.
- Add ESLint/formatting, strict TypeScript, and basic component tests.
- Add README setup instructions.
- Do not add audio processing or third-party APIs yet.

Create a polished shell with:
- right-side Arabic navigation
- library search
- poem cards
- one sample poem player screen
- responsive window behavior down to 900x600

Run all checks and start the dev app if the environment supports it. Stop after reporting the results.
```

Acceptance criteria:

- `npm run build` succeeds.
- Type checking succeeds with no errors.
- Arabic text is RTL, but time values and technical labels remain readable.
- Library and player screens render with mock data.

Commit checkpoint:

```bash
git add .
git commit -m "feat: scaffold Arabic poetry desktop UI"
```

---

## 3. Phase 2 — Define the data model and local persistence

```text
Implement Phase 2 only: typed domain models and SQLite persistence.

Create models for:
- Poet
- Poem
- Verse
- Recording
- VerseAlignment
- WordDefinition
- MeterAnalysis
- ImportJob

Each verse must preserve:
- original diacritized text
- normalized text used for matching
- hemistich parts when available
- order index

Each alignment must store:
- start_ms
- end_ms
- confidence from 0 to 1
- status: auto | reviewed | manual
- transcript token range

Use SQLite through an official/current Tauri 2-compatible plugin. Add migrations, repository functions, and tests. Store audio files in the application data directory; store only paths and metadata in SQLite.

Add a development seed command with two public-domain sample poems and synthetic alignment timestamps. Connect the Library and Player UI to SQLite instead of hard-coded arrays.

Do not implement downloading, ASR, or external APIs. Run migrations, tests, type checking, and builds.
```

Acceptance criteria:

- Fresh database migration works.
- Seed is idempotent.
- App restart preserves data.
- CRUD repository tests pass.

---

## 4. Phase 3 — Audio player and synchronized verses

```text
Implement Phase 3 only: local audio import and synchronized playback.

Requirements:
- Let the user choose a local MP3, M4A, OGG, FLAC, or WAV file through a Tauri file dialog.
- Copy the selected file into the app data directory using a collision-safe name.
- Build a reusable audio controller with play, pause, seek, duration, current time, playback speed, and volume.
- Highlight the active verse using start_ms/end_ms.
- Smoothly auto-scroll while preserving manual user scrolling.
- Clicking a verse seeks to its start.
- Keyboard shortcuts: Space play/pause, arrows seek, J/K/L optional.
- Display missing-file and unsupported-codec errors clearly.
- Use current seeded timestamps for this phase.

Do not add ASR yet. Add unit tests for active-verse selection, seeking, and boundary edge cases. Run all checks.
```

Acceptance criteria:

- Playback works with a local test audio file.
- Active verse changes at exact millisecond boundaries.
- Seeking and keyboard controls work.
- No interval leaks or duplicated playback listeners.

---

## 5. Phase 4 — Python processing worker

```text
Implement Phase 4 only: a standalone Python audio-processing worker and Tauri bridge.

Create a Python package under worker/ with a CLI that communicates through newline-delimited JSON on stdin/stdout. Logs must go to stderr.

Commands:
- health
- inspect_audio
- convert_audio
- detect_speech

Pipeline:
- validate input paths and file size
- inspect with ffprobe
- convert with ffmpeg to 16 kHz mono PCM WAV
- detect speech regions using Silero VAD or an equivalent maintained VAD
- return duration, speech intervals, and processing diagnostics

Security:
- never construct shell command strings
- pass subprocess arguments as arrays
- restrict outputs to the job directory
- use timeouts and cancellation
- return structured error codes

Add Python unit tests and small generated WAV fixtures. Add a Rust/Tauri command that starts the worker, parses progress events, supports cancellation, and reports failures to the UI.

Do not implement Whisper transcription or alignment yet.
```

Acceptance criteria:

- Worker health check succeeds.
- A generated WAV fixture is inspected and processed.
- Malformed commands do not crash the worker.
- Tauri receives progress and completion events.

---

## 6. Phase 5 — Arabic ASR with word timestamps

```text
Implement Phase 5 only: Arabic speech transcription.

Add a transcribe command to the Python worker using faster-whisper by default. Make the model configurable: tiny, base, small, medium, large-v3. Default to small for development.

Requirements:
- language fixed or strongly hinted as Arabic
- word-level timestamps
- segment and word probabilities where available
- VAD-filtered processing
- optional CPU/GPU device and compute type
- model download progress and clear disk-space errors
- cached models outside the repository
- cancellation support
- transcript JSON saved in the job directory

Define a stable transcript schema containing:
- raw text
- segments
- words
- start_ms/end_ms
- probability/confidence

Add tests that mock the ASR engine, plus one opt-in integration test that runs only when a local model is available. Add UI settings for model/device and a transcription progress view.

Do not implement poem alignment yet.
```

Acceptance criteria:

- Mocked ASR tests pass.
- Transcript schema validates.
- Real integration test is optional and clearly documented.
- App stays responsive during processing.

---

## 7. Phase 6 — Arabic normalization and forced alignment

```text
Implement Phase 6 only: align timestamped ASR words to poem verses.

Create pure, thoroughly tested Python modules:

1. Arabic normalization:
- remove tashkeel for matching but preserve original text
- remove tatweel and punctuation
- normalize أ إ آ ٱ to ا
- normalize ى to ي
- optionally normalize ة to ه only in a secondary fuzzy comparison, not the primary representation
- normalize whitespace
- support Arabic-Indic digits

2. Token similarity:
- exact normalized match
- character similarity
- optional Arabic stem/root-aware bonus only if reliable
- configurable thresholds

3. Semi-global sequence alignment:
- poem tokens versus ASR tokens
- free leading/trailing gaps in transcript
- penalties for insertions, omissions, and substitutions
- monotonic token matching

4. Verse boundary calculation:
- derive each verse start/end from matched timed words
- interpolate cautiously when one verse has missing words
- clamp neighboring boundaries at safe midpoints
- flag verses with insufficient evidence instead of inventing precision

5. Confidence:
- match coverage
- average token similarity
- ASR confidence
- temporal consistency
- return component scores and total score

Create Arabic test fixtures for:
- diacritics
- hamza variants
- intro speech before the poem
- omitted words
- repeated refrains
- ASR substitutions
- unmatched verse

Expose an align command through the worker and save alignment JSON. Do not slice audio yet.
```

Acceptance criteria:

- All normalization fixtures pass.
- Intro speech does not shift the poem alignment.
- Output timestamps are monotonic and within audio duration.
- Low-evidence verses are marked for review.
- No claim of “millisecond precision” is shown in the UI; timestamps are estimates derived from ASR.

---

## 8. Phase 7 — Boundary review editor

```text
Implement Phase 7 only: human review and correction.

Add a waveform using wavesurfer.js or another maintained library compatible with the current frontend.

Features:
- overview waveform
- draggable start/end markers for the selected verse
- zoom and horizontal scroll
- play selected verse
- jump to previous/next low-confidence verse
- prevent invalid or overlapping ranges unless explicitly resolved
- undo/reset current verse
- save reviewed boundaries to SQLite with status=reviewed
- confidence badges: green >= 0.80, amber >= 0.65, red below 0.65

Add tests for boundary validation and persistence. Ensure keyboard access for adjustments.
```

Acceptance criteria:

- User can correct a bad boundary and save it.
- Corrected timestamps survive restart.
- Invalid negative, reversed, and out-of-duration boundaries are rejected.

---

## 9. Phase 8 — Poem imports and provider interfaces

```text
Implement Phase 8 only: safe poem import architecture.

Create a provider interface:
- identify_url
- fetch_poem
- fetch_definitions
- fetch_meter
- health_check

Implement:
1. Manual paste/import as the guaranteed provider.
2. JSON file import/export using a versioned schema.
3. Optional adapters for Mizan Al-Arab and AlDiwan only after verifying their current public behavior and terms. Do not bypass anti-bot protection, authentication, rate limits, or robots rules. Do not invent endpoints.

Manual import must support:
- title
- poet
- era
- meter
- one verse per line or two hemistichs separated by a configurable delimiter
- preview and correction before saving

Add fixtures and provider contract tests. If a website adapter cannot be implemented legally and reliably, leave it disabled with an explanation in documentation.
```

Acceptance criteria:

- Manual import works completely offline.
- JSON round-trip preserves Arabic text and diacritics.
- External provider failure never blocks local use.

---

## 10. Phase 9 — Local dictionary and literary analysis

```text
Implement Phase 9 only: vocabulary and analysis architecture.

Requirements:
- Click a word to open a definition panel.
- Normalize the lookup form while displaying the original word.
- Define a lexicon provider interface supporting local SQLite and optional remote sources.
- Do not bundle copyrighted dictionary data without a compatible license.
- Include a tiny public-domain or developer-authored fixture lexicon for tests.
- Record source name and attribution for every definition.
- Cache permitted remote results locally.
- Add meter fields and manually entered literary explanation.
- Keep optional AI explanation behind a separate explicit user action and label generated text as AI-generated.

Do not add cloud AI keys directly to source code. Document how secrets are configured.
```

Acceptance criteria:

- Word lookup works with fixture data.
- Missing definitions have a useful empty state.
- Every displayed definition includes source attribution.

---

## 11. Phase 10 — Audio segmentation and export

```text
Implement Phase 10 only: export reviewed results.

Add worker commands to:
- cut one verse audio clip
- export all reviewed verse clips
- export complete versioned poem JSON

Use ffmpeg with midpoint clamping and configurable padding. Never overwrite source audio. Sanitize filenames and write exports to a user-selected folder.

Add an export manifest containing poem metadata, source recording metadata, verse text, timestamps, confidence, review status, and clip filenames.

Add tests using generated audio fixtures. Verify clip durations with ffprobe.
```

Acceptance criteria:

- Exported clips have positive duration.
- Files do not overlap incorrectly.
- Manifest paths match created files.
- Cancelled export leaves no misleading “complete” manifest.

---

## 12. Phase 11 — Packaging and reliability

```text
Implement Phase 11 only: release preparation.

Requirements:
- Bundle or clearly install-check required runtime dependencies.
- Decide and document whether Python/ffmpeg are bundled or installed separately for each OS.
- Add first-run diagnostics.
- Add structured application logs with a user-accessible “Open logs folder” action.
- Add graceful job recovery after a crash.
- Add import/export backup.
- Add GitHub Actions or equivalent CI for frontend, Rust, and Python tests.
- Configure Tauri packaging for Windows, macOS, and Linux where the environment permits.
- Add application icons, versioning, license, acknowledgements, and privacy documentation.

Do not claim packages were tested on an OS unless they actually ran there. Produce a release checklist with unverified items clearly marked.
```

Acceptance criteria:

- CI configuration validates.
- Development build passes.
- Packaging command succeeds for the current host.
- Documentation states exact platform limitations.

---

## 13. Prompts for debugging

When a phase fails, paste:

```text
Do not add features. Diagnose the current failure.

1. Reproduce it with the smallest command.
2. Quote the important error lines.
3. Identify the root cause, not only the symptom.
4. Propose the smallest safe fix.
5. Implement it.
6. Add or update a regression test.
7. Rerun the failed command and all nearby checks.
8. Report what remains unverified.
```

For code review after every three phases:

```text
Perform a read-only architecture and security review of the repository.

Check:
- unsafe Tauri commands and filesystem access
- command injection
- path traversal
- blocking work on the UI thread
- leaked subprocesses
- unbounded files or model downloads
- SQLite migration correctness
- TypeScript/Python schema drift
- Arabic Unicode normalization bugs
- inaccessible RTL controls
- false success messages
- missing tests

Rank findings by severity and give exact file references. Do not edit files until I approve the remediation plan.
```

---

## 14. Suggested repository structure

```text
diwan/
├── src/
│   ├── components/
│   ├── features/
│   │   ├── library/
│   │   ├── player/
│   │   ├── import/
│   │   ├── alignment/
│   │   └── dictionary/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── styles/
├── src-tauri/
│   ├── migrations/
│   └── src/
│       ├── commands/
│       ├── db/
│       ├── jobs/
│       └── security/
├── worker/
│   ├── diwan_worker/
│   │   ├── audio/
│   │   ├── asr/
│   │   ├── alignment/
│   │   ├── providers/
│   │   ├── schemas/
│   │   └── cli.py
│   └── tests/
├── fixtures/
├── docs/
└── README.md
```

## 15. Recommended first MVP

Do not begin with every feature from the concept. The first genuinely useful release should do only this:

1. Manually paste a poem.
2. Import a local audio recording.
3. Transcribe it in Arabic.
4. Align transcript words to verses.
5. Play audio with synchronized highlighting.
6. Let the user correct timestamps.
7. Save everything locally.

After this works reliably, add websites, dictionaries, meter analysis, cloud AI, YouTube import, social video, and platform installers. This order keeps the hardest technical risk—the quality of Arabic forced alignment—visible early instead of hiding it behind a polished interface.