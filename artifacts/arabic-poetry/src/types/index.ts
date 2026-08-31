export type Era = 
  | 'جاهلي' 
  | 'إسلامي' 
  | 'أموي' 
  | 'عباسي' 
  | 'أندلسي' 
  | 'مملوكي' 
  | 'عثماني' 
  | 'حديث' 
  | 'معاصر';

export type Bahr = 
  | 'الطويل' 
  | 'البسيط' 
  | 'الكامل' 
  | 'الوافر' 
  | 'الخفيف' 
  | 'الرمل' 
  | 'الرجز' 
  | 'المتقارب' 
  | 'المتدارك' 
  | 'السريع' 
  | 'المنسرح' 
  | 'المقتضب' 
  | 'المجتث' 
  | 'المضارع' 
  | 'الهزج' 
  | 'تفعيلة / حر';

export interface Poet {
  id: string;
  name: string;
  era: Era;
  bio?: string;
  birthYear?: string;
  deathYear?: string;
  avatarUrl?: string;
  externalId?: string;
}

export interface VerseExplanationItem {
  id: string;
  verseId: string;
  verseExternalId?: string;
  text: string;
  author?: string;
  authorDeathHijri?: string;
  sourceTitle?: string;
  explanationType: 'classical' | 'verse' | 'manual' | 'rhetorical';
  provider: string;
  rawSourceJson?: string;
  createdAt?: string;
}

export interface Verse {
  id: string;
  poemId: string;
  orderIndex: number;
  // Diacritized text
  text: string;
  // Normalized text used for matching / searching
  normalizedText: string;
  // Hemistichs (First half / Second half)
  firstHemistich: string;
  secondHemistich: string;
  // Synthetic / real alignment
  alignment?: VerseAlignment;
  explanation?: string;
  externalId?: string;
  explanations?: VerseExplanationItem[];
}

/**
 * A discrepancy detected while importing an explanation, between how the
 * explanation quotes a verse (or verses) and how the poem's own verse
 * records are currently segmented — e.g. the explanation's quoted line
 * splits into two hemistichs at a different point than the stored verse, or
 * shows one bayt where the poem currently has it stored as two separate
 * verse rows (or vice versa). Always presented to the user for confirmation
 * before anything is changed.
 */
export interface VerseSegmentationSuggestion {
  id: string;
  kind: 'hemistich_split' | 'merge_verses' | 'split_verse';
  /** Affected verse id(s), in poem order. */
  verseIds: string[];
  /** Short Arabic description of the detected issue. */
  description: string;
  /** Current hemistich pairs for the affected verse(s), in the same order as verseIds. */
  current: { firstHemistich: string; secondHemistich: string }[];
  /** Suggested hemistich pairs to replace the current ones. Length differs from `current` for merge (2 -> 1) and split (1 -> 2). */
  suggested: { firstHemistich: string; secondHemistich: string }[];
}

export type AlignmentStatus = 'auto' | 'review' | 'reviewed' | 'manual';

/**
 * A full point-in-time capture of one verse row for undo/redo restoration:
 * unlike the `Verse` shape returned by normal reads (which attaches only
 * the single best/default-recording alignment as `alignment`), this keeps
 * every alignment across every recording so restoring a snapshot can never
 * silently drop timing data for a non-default recording.
 */
export interface VerseSnapshotEntry
  extends Omit<Verse, "alignment"> {
  alignments: VerseAlignment[];
}

export interface VerseAlignment {
  id: string;
  verseId: string;
  recordingId: string;
  startMs: number;
  endMs: number;
  confidence: number; // 0.0 to 1.0
  status: AlignmentStatus;
  transcriptRange?: {
    startTokenIndex: number;
    endTokenIndex: number;
  };
}

export interface Recording {
  id: string;
  poemId: string;
  title: string;
  reciter: string;
  audioPath: string; // File path in app data
  durationMs: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
  createdAt: string;
}

export interface Poem {
  id: string;
  title: string;
  poet: Poet;
  era: Era;
  bahr: Bahr;
  rhyme: string; // القافية / الروي
  description?: string;
  versesCount: number;
  verses: Verse[];
  recordings: Recording[];
  defaultRecordingId?: string;
  tags: string[];
  externalProvider?: string;
  externalId?: string;
  sourceUrl?: string;
  theme?: string;
  verified?: boolean;
  coverImageUrl?: string;
}

export interface WordDefinition {
  id: string;
  word: string;
  normalizedWord: string;
  root?: string;
  meaning: string;
  source: string; // e.g. "لسان العرب"
}

export interface MeterAnalysis {
  bahr: Bahr;
  pattern: string; // e.g. "فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِلُنْ"
  tafeelaBreakdown: string[];
}

export interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  jobType: 'audio_transcription' | 'verse_alignment' | 'poem_import' | 'youtube_download';
  /** Human-readable title shown in the queue UI (e.g. the poem title). */
  title: string;
  /** Machine id of the current pipeline stage, e.g. "queued" | "download" | "convert" | "vad" | "asr" | "align" | "saving" | "done". */
  stage: string;
  /** Arabic label of the current stage, shown directly in the UI. */
  stageLabel: string;
  inputPath?: string;
  outputPath?: string;
  progress: number; // 0.0 to 1.0
  errorMessage?: string;
  /** How many times this job has been retried after a failure. */
  retryCount: number;
  /** Soft cap surfaced in the UI; manual retries are never hard-blocked by it. */
  maxRetries: number;
  /** Cooperative cancellation flag checked by the queue processor between stages. */
  cancelRequested: boolean;
  /** JSON-encoded job input, shaped differently per jobType, needed to (re)run the job. */
  payload: string;
  /** JSON-encoded job output once completed (e.g. { poemId } or download info). */
  resultJson?: string;
  /** Whether the completion/failure notification for this job has already been shown. */
  notified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  poemIds: string[]; // ordered
  createdAt: string;
  updatedAt: string;
}

export type RepeatMode = 'off' | 'one' | 'all';

export type ActiveTab = 'library' | 'player' | 'import' | 'settings' | 'playlists';
