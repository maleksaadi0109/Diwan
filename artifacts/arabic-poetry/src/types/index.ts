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
  explanationType: 'classical' | 'verse' | 'manual';
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

export type AlignmentStatus = 'auto' | 'review' | 'reviewed' | 'manual';

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
  inputPath?: string;
  outputPath?: string;
  progress: number; // 0.0 to 1.0
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActiveTab = 'library' | 'player' | 'editor' | 'import' | 'settings';
