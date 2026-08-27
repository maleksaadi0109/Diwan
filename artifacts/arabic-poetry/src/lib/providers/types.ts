import { Era, Bahr } from "@/types";

export interface ParsedVersePayload {
  orderIndex: number;
  externalId?: string;
  text: string;
  firstHemistich: string;
  secondHemistich: string;
}

export interface ParsedPoemPayload {
  title: string;
  poetName: string;
  era: Era;
  bahr: Bahr;
  rhyme: string;
  description?: string;
  verses: ParsedVersePayload[];
  rawText?: string;
  sourceUrl?: string;
}

export interface PoemImportProvider {
  id: string;
  name: string;
  description: string;
  supportsUrl: boolean;
  parseRawText: (text: string, options?: Record<string, unknown>) => ParsedPoemPayload;
  fetchByUrl?: (url: string) => Promise<ParsedPoemPayload>;
}
