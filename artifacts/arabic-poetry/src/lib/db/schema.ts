export const INITIAL_SCHEMA_SQL = `
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
    default_recording_id TEXT,
    external_provider TEXT,
    external_id TEXT,
    source_url TEXT,
    theme TEXT,
    verified INTEGER DEFAULT 0,
    cover_image_url TEXT,
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
    external_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poem_id, order_index)
);

CREATE TABLE IF NOT EXISTS verse_explanations (
    id TEXT PRIMARY KEY,
    verse_id TEXT NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
    verse_external_id TEXT,
    text TEXT NOT NULL,
    author TEXT,
    author_death_hijri TEXT,
    source_title TEXT,
    explanation_type TEXT NOT NULL, -- 'classical' | 'verse' | 'manual'
    provider TEXT NOT NULL,         -- 'mizan_al_arab' | 'aldewan' | 'local'
    raw_source_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    title TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT 'queued',
    stage_label TEXT NOT NULL DEFAULT '',
    input_path TEXT,
    output_path TEXT,
    progress REAL NOT NULL DEFAULT 0.0,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    payload TEXT NOT NULL DEFAULT '{}',
    result_json TEXT,
    notified INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_poems (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    poem_id TEXT NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, poem_id),
    UNIQUE (playlist_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_poems_poet_id ON poems(poet_id);
CREATE INDEX IF NOT EXISTS idx_poems_era ON poems(era);
CREATE INDEX IF NOT EXISTS idx_verses_poem_id ON verses(poem_id);
CREATE INDEX IF NOT EXISTS idx_verses_normalized_text ON verses(normalized_text);
CREATE INDEX IF NOT EXISTS idx_verse_explanations_verse_id ON verse_explanations(verse_id);
CREATE INDEX IF NOT EXISTS idx_recordings_poem_id ON recordings(poem_id);
CREATE INDEX IF NOT EXISTS idx_alignments_verse_rec ON verse_alignments(verse_id, recording_id);
CREATE INDEX IF NOT EXISTS idx_definitions_normalized_word ON word_definitions(normalized_word);
CREATE INDEX IF NOT EXISTS idx_playlist_poems_playlist_id ON playlist_poems(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_poems_poem_id ON playlist_poems(poem_id);
`;

export interface PoetRow {
  id: string;
  name: string;
  era: string;
  bio: string | null;
  birth_year: string | null;
  death_year: string | null;
  created_at?: string;
}

export interface PoemRow {
  id: string;
  title: string;
  poet_id: string;
  era: string;
  bahr: string;
  rhyme: string;
  description: string | null;
  verses_count: number;
  tags: string;
  default_recording_id: string | null;
  external_provider: string | null;
  external_id: string | null;
  source_url: string | null;
  theme: string | null;
  verified: number;
  cover_image_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VerseRow {
  id: string;
  poem_id: string;
  order_index: number;
  text: string;
  normalized_text: string;
  first_hemistich: string;
  second_hemistich: string;
  explanation: string | null;
  external_id: string | null;
  created_at?: string;
}

export interface VerseExplanationRow {
  id: string;
  verse_id: string;
  verse_external_id: string | null;
  text: string;
  author: string | null;
  author_death_hijri: string | null;
  source_title: string | null;
  explanation_type: string;
  provider: string;
  raw_source_json: string | null;
  created_at?: string;
}

export interface RecordingRow {
  id: string;
  poem_id: string;
  title: string;
  reciter: string;
  audio_path: string;
  duration_ms: number;
  sample_rate: number | null;
  channels: number | null;
  format: string | null;
  created_at: string;
}

export interface VerseAlignmentRow {
  id: string;
  verse_id: string;
  recording_id: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  status: string;
  start_token_index: number | null;
  end_token_index: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface WordDefinitionRow {
  id: string;
  word: string;
  normalized_word: string;
  root: string | null;
  meaning: string;
  source: string;
  created_at?: string;
}

export interface MeterAnalysisRow {
  id: string;
  poem_id: string;
  verse_id: string | null;
  bahr: string;
  pattern: string;
  tafeela_breakdown: string;
  created_at?: string;
}

export interface ImportJobRow {
  id: string;
  status: string;
  job_type: string;
  title: string | null;
  stage: string | null;
  stage_label: string | null;
  input_path: string | null;
  output_path: string | null;
  progress: number;
  error_message: string | null;
  retry_count: number | null;
  max_retries: number | null;
  cancel_requested: number | null;
  payload: string | null;
  result_json: string | null;
  notified: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlaylistRow {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlaylistPoemRow {
  playlist_id: string;
  poem_id: string;
  order_index: number;
  added_at?: string;
}
