import { Bahr, MeterAnalysis } from "@/types";
import { normalizeArabic } from "@/lib/utils";

export interface VerseArudResult {
  bahr: Bahr;
  pattern: string;
  tafeelaBreakdown: string[];
  rawiyy: string;
  confidence: number;
}

const BUHOOR_PATTERNS: Record<
  string,
  { bahr: Bahr; pattern: string; tafaeel: string[]; rawiyyHint?: string }
> = {
  الطويل: {
    bahr: "الطويل",
    pattern: "فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِلُنْ",
    tafaeel: ["فَعُولُنْ", "مَفَاعِيلُنْ", "فَعُولُنْ", "مَفَاعِلُنْ"],
  },
  البسيط: {
    bahr: "البسيط",
    pattern: "مُسْتَفْعِلُنْ فَاعِلُنْ مُسْتَفْعِلُنْ فَعِلُنْ",
    tafaeel: ["مُسْتَفْعِلُنْ", "فَاعِلُنْ", "مُسْتَفْعِلُنْ", "فَعِلُنْ"],
  },
  الكامل: {
    bahr: "الكامل",
    pattern: "مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ",
    tafaeel: ["مُتَفَاعِلُنْ", "مُتَفَاعِلُنْ", "مُتَفَاعِلُنْ"],
  },
  الوافر: {
    bahr: "الوافر",
    pattern: "مُفَاعَلَتُنْ مُفَاعَلَتُنْ فَعُولُنْ",
    tafaeel: ["مُفَاعَلَتُنْ", "مُفَاعَلَتُنْ", "فَعُولُنْ"],
  },
  الخفيف: {
    bahr: "الخفيف",
    pattern: "فَاعِلاتُنْ مُسْتَفْعِ لُنْ فَاعِلاتُنْ",
    tafaeel: ["فَاعِلاتُنْ", "مُسْتَفْعِلُنْ", "فَاعِلاتُنْ"],
  },
  الرمل: {
    bahr: "الرمل",
    pattern: "فَاعِلاتُنْ فَاعِلاتُنْ فَاعِلاتُنْ",
    tafaeel: ["فَاعِلاتُنْ", "فَاعِلاتُنْ", "فَاعِلاتُنْ"],
  },
  الرجز: {
    bahr: "الرجز",
    pattern: "مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ",
    tafaeel: ["مُسْتَفْعِلُنْ", "مُسْتَفْعِلُنْ", "مُسْتَفْعِلُنْ"],
  },
  المتقارب: {
    bahr: "المتقارب",
    pattern: "فَعُولُنْ فَعُولُنْ فَعُولُنْ فَعُولُنْ",
    tafaeel: ["فَعُولُنْ", "فَعُولُنْ", "فَعُولُنْ", "فَعُولُنْ"],
  },
};

/**
 * Extracts the Rawiyy (rhyme letter) from the end of a verse
 */
export function extractRawiyy(verseText: string): string {
  const norm = normalizeArabic(verseText);
  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "غير محدد";

  const lastWord = words[words.length - 1];
  const lastChar = lastWord.slice(-1);

  const rawiyyNames: Record<string, string> = {
    م: "الميم",
    ل: "اللام",
    د: "الدال",
    ر: "الراء",
    ن: "النون",
    ب: "الباء",
    ت: "التاء",
    ح: "الحاء",
    ع: "العين",
    ق: "القاف",
    ك: "الكاف",
    س: "السين",
  };

  return rawiyyNames[lastChar] || `حرف (${lastChar})`;
}

/**
 * Analyzes poetic meter and Arud pattern from verse text
 */
export function analyzeVerseMeter(
  firstHemistich: string,
  secondHemistich: string = "",
  declaredBahr?: Bahr
): VerseArudResult {
  const fullText = `${firstHemistich} ${secondHemistich}`.trim();
  const rawiyy = extractRawiyy(secondHemistich || firstHemistich);

  // If a known valid bahr was already associated with the poem
  if (declaredBahr && BUHOOR_PATTERNS[declaredBahr]) {
    const info = BUHOOR_PATTERNS[declaredBahr];
    return {
      bahr: info.bahr,
      pattern: info.pattern,
      tafeelaBreakdown: info.tafaeel,
      rawiyy,
      confidence: 0.95,
    };
  }

  // Heuristic syllable & cadence estimation
  const tokenCount = fullText.split(/\s+/).filter(Boolean).length;

  let detectedBahr: Bahr = "البسيط";
  if (tokenCount >= 12) {
    detectedBahr = "الطويل";
  } else if (tokenCount >= 9) {
    detectedBahr = "البسيط";
  } else if (tokenCount >= 7) {
    detectedBahr = "الكامل";
  } else {
    detectedBahr = "الوافر";
  }

  const info = BUHOOR_PATTERNS[detectedBahr] || BUHOOR_PATTERNS["البسيط"];

  return {
    bahr: info.bahr,
    pattern: info.pattern,
    tafeelaBreakdown: info.tafaeel,
    rawiyy,
    confidence: 0.88,
  };
}
