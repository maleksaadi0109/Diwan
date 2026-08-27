-- Initial Schema for Diwan Arabic Poetry Desktop

CREATE TABLE IF NOT EXISTS poets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    era TEXT NOT NULL,
    bio TEXT,
    birth_year TEXT,
    death_year TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS poems (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    poet_id TEXT NOT NULL REFERENCES poets(id) ON DELETE CASCADE,
    era TEXT NOT NULL,
    bahr TEXT NOT NULL,
    rhyme TEXT NOT NULL,
    description TEXT,
    verses_count INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verses (
    id TEXT PRIMARY KEY,
    poem_id TEXT NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    first_hemistich TEXT NOT NULL,
    second_hemistich TEXT NOT NULL,
    explanation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poem_id, order_index)
);

CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    poem_id TEXT NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    reciter TEXT NOT NULL,
    audio_path TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    sample_rate INTEGER,
    channels INTEGER,
    format TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verse_alignments (
    id TEXT PRIMARY KEY,
    verse_id TEXT NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'auto',
    start_token_index INTEGER,
    end_token_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(verse_id, recording_id)
);

CREATE TABLE IF NOT EXISTS word_definitions (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    root TEXT,
    meaning TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meter_analyses (
    id TEXT PRIMARY KEY,
    poem_id TEXT NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
    verse_id TEXT REFERENCES verses(id) ON DELETE CASCADE,
    bahr TEXT NOT NULL,
    pattern TEXT NOT NULL,
    tafeela_breakdown TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    job_type TEXT NOT NULL,
    input_path TEXT,
    output_path TEXT,
    progress REAL NOT NULL DEFAULT 0.0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poems_poet_id ON poems(poet_id);
CREATE INDEX IF NOT EXISTS idx_poems_era ON poems(era);
CREATE INDEX IF NOT EXISTS idx_verses_poem_id ON verses(poem_id);
CREATE INDEX IF NOT EXISTS idx_verses_normalized_text ON verses(normalized_text);
CREATE INDEX IF NOT EXISTS idx_recordings_poem_id ON recordings(poem_id);
CREATE INDEX IF NOT EXISTS idx_alignments_verse_rec ON verse_alignments(verse_id, recording_id);
CREATE INDEX IF NOT EXISTS idx_definitions_normalized_word ON word_definitions(normalized_word);
