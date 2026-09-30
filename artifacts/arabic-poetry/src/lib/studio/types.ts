export interface StudioVerse {
  id: string;
  firstHemistich: string;
  secondHemistich: string;
}

export interface StudioDraft {
  id: string;
  title: string;
  verses: StudioVerse[];
  targetRhyme?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StudioStorageData {
  version: 1;
  drafts: StudioDraft[];
  activeDraftId: string | null;
}
