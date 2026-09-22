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

  useEffect(() => {
    if (!isRecording || normalizedPoemWords.length === 0) {
      activeRef.current = false;
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
      const transcriptParts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        transcriptParts.push(event.results[index][0]?.transcript || "");
      }
      const spokenWords = transcriptParts
        .join(" ")
        .trim()
        .split(/\s+/)
        .map(normalizeArabicWord)
        .filter(Boolean);
      setRecognizedWordCount(matchRecitationProgress(normalizedPoemWords, spokenWords));
    };
    recognition.onerror = () => {
      setRecognitionAvailable(false);
    };
    recognition.onend = () => {
      if (!activeRef.current) return;
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

function matchRecitationProgress(poemWords: string[], spokenWords: string[]): number {
  let poemIndex = 0;
  for (const spokenWord of spokenWords) {
    if (!spokenWord) continue;
    const searchEnd = Math.min(poemWords.length, poemIndex + 8);
    for (let candidate = poemIndex; candidate < searchEnd; candidate += 1) {
      if (wordsMatch(poemWords[candidate], spokenWord)) {
        poemIndex = candidate + 1;
        break;
      }
    }
  }
  return poemIndex;
}

function wordsMatch(poemWord: string, spokenWord: string): boolean {
  if (poemWord === spokenWord) return true;
  const shortestLength = Math.min(poemWord.length, spokenWord.length);
  return shortestLength >= 3 && (
    poemWord.includes(spokenWord) ||
    spokenWord.includes(poemWord)
  );
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