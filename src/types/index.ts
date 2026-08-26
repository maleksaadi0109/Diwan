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
}

export interface VerseAlignment {
  id: string;
  verseId: string;
  recordingId: string;
  startMs: number;
  endMs: number;
  confidence: number; // 0.0 to 1.0
  status: 'auto' | 'reviewed' | 'manual';
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
  status: 'pending' | 'processing' | 'completed' | 'failed';
  jobType: 'audio_transcription' | 'verse_alignment' | 'poem_import';
  inputPath?: string;
  outputPath?: string;
  progress: number; // 0.0 to 1.0
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActiveTab = 'library' | 'player' | 'import' | 'settings';
