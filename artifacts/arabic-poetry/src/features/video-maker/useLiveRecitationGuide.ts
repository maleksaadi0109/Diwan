import { useEffect, useMemo, useRef, useState } from "react";
import { Poem } from "@/types";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface RecitationProgressState {
  confirmedWordCount: number;
  processedFinalResultCount: number;
}

export function processFinalSpeechResults(
  state: RecitationProgressState,
  poemWords: string[],
  results: ArrayLike<SpeechRecognitionResultLike>,
): RecitationProgressState {
  const finalWords: string[][] = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (!result?.isFinal) continue;
    finalWords.push(tokenizeRecognizedText(result[0]?.transcript || ""));
  }

  // Final results are stable within one SpeechRecognition session. Only
  // consume the suffix we have not seen; interim results are intentionally
  // ignored because browsers revise them and they caused false green words.
  const newFinalWords = finalWords.slice(state.processedFinalResultCount);
  let confirmedWordCount = state.confirmedWordCount;
  for (const words of newFinalWords) {
    confirmedWordCount = advanceRecitationProgress(poemWords, words, confirmedWordCount);
  }

  return {
    confirmedWordCount,
    processedFinalResultCount: finalWords.length,
  };
}

export function useLiveRecitationGuide(
  poem: Poem | null,
  isRecording: boolean
) {
  const poemWords = useMemo(
    () => poem?.verses.flatMap((verse) => verse.text.trim().split(/\s+/)) || [],
    [poem]
  );
  const normalizedPoemWords = useMemo(
    () => poemWords.map(normalizeArabicWord),
    [poemWords]
  );
  const [recognizedWordCount, setRecognizedWordCount] = useState(0);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const activeRef = useRef(false);
  const progressRef = useRef<RecitationProgressState>({
    confirmedWordCount: 0,
    processedFinalResultCount: 0,
  });

  useEffect(() => {
    if (!isRecording || normalizedPoemWords.length === 0) {
      activeRef.current = false;
      progressRef.current = {
        confirmedWordCount: 0,
        processedFinalResultCount: 0,
      };
      setRecognizedWordCount(0);
      setRecognitionAvailable(false);
      return;
    }

    const recognitionConstructor = (
      window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).SpeechRecognition || (
      window as typeof window & {
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;

    if (!recognitionConstructor) return;

    const recognition = new recognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ar-SA";
    activeRef.current = true;
    setRecognitionAvailable(true);

    recognition.onresult = (event) => {
      progressRef.current = processFinalSpeechResults(
        progressRef.current,
        normalizedPoemWords,
        event.results,
      );
      setRecognizedWordCount(progressRef.current.confirmedWordCount);
    };
    recognition.onerror = () => {
      setRecognitionAvailable(false);
    };
    recognition.onend = () => {
      if (!activeRef.current) return;
      // A restarted recognition session has a fresh result list. Keep words
      // already confirmed, but allow its first final result to be consumed.
      progressRef.current = {
        ...progressRef.current,
        processedFinalResultCount: 0,
      };
      try {
        recognition.start();
      } catch {
        setRecognitionAvailable(false);
      }
    };

    try {
      recognition.start();
    } catch {
      setRecognitionAvailable(false);
    }

    return () => {
      activeRef.current = false;
      recognition.onend = null;
      recognition.stop();
    };
  }, [isRecording, normalizedPoemWords]);

  return {
    highlightedWordCount: recognizedWordCount,
    guideMode: recognitionAvailable ? "speech" as const : "unavailable" as const,
  };
}

export function advanceRecitationProgress(
  poemWords: string[],
  spokenWords: string[],
  startIndex = 0,
): number {
  let poemIndex = startIndex;
  for (const spokenWord of spokenWords) {
    if (!spokenWord) continue;
    // Deliberately require the next word. Skipping ahead or matching by
    // substring makes a repeated/partially recognized word turn green early.
    if (wordsMatch(
      normalizeArabicWord(poemWords[poemIndex] || ""),
      normalizeArabicWord(spokenWord),
    )) poemIndex += 1;
  }
  return poemIndex;
}

function wordsMatch(poemWord: string, spokenWord: string): boolean {
  return poemWord === spokenWord;
}

function tokenizeRecognizedText(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .map(normalizeArabicWord)
    .filter(Boolean);
}

function normalizeArabicWord(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064A]/g, "");
}