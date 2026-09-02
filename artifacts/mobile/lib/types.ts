export interface VerseAlignment {
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface Verse {
  id: string;
  orderIndex: number;
  text: string;
  alignment?: VerseAlignment;
}

export interface Recording {
  id: string;
  audioUrl: string;
  durationMs: number;
}

export interface Poem {
  id: string;
  title: string;
  poetName: string;
  verses: Verse[];
  recording?: Recording;
  createdAt: number;
  sourceUrl?: string;
  /** Set when imported from a curated provider (e.g. "mizan_al_arab") so a
   * catalog entry can detect it was already imported and avoid duplicates. */
  externalProvider?: string;
  externalId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  poemIds: string[];
  createdAt: number;
}
