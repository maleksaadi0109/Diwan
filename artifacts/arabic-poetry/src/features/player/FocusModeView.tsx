import React, { useEffect, useState } from "react";
import { Poem, Verse } from "@/types";
import { cn } from "@/lib/utils";
import { X, Play, Pause, Minus, Plus, MoveVertical } from "lucide-react";

interface FocusModeViewProps {
  poem: Poem;
  activeVerseIndex: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekToVerse: (verse: Verse) => void;
  onExit: () => void;
}

// Text-size presets for presentation mode. "md" matches the historical
// Focus Mode default size so existing users see no visual change unless
// they explicitly adjust it.
const FONT_SCALES = [
  { key: "sm", label: "صغير", textClass: "text-xl md:text-3xl" },
  { key: "md", label: "متوسط", textClass: "text-2xl md:text-[40px]" },
  { key: "lg", label: "كبير", textClass: "text-3xl md:text-[52px]" },
  { key: "xl", label: "كبير جدًا", textClass: "text-4xl md:text-[64px]" },
] as const;

// Line-spacing presets. "comfortable" matches the historical default.
const LINE_SPACINGS = [
  { key: "compact", label: "متقارب", leadingClass: "leading-[1.9]" },
  { key: "comfortable", label: "مريح", leadingClass: "leading-[2.6]" },
  { key: "spacious", label: "واسع", leadingClass: "leading-[3.4]" },
] as const;

const STORAGE_FONT_SCALE = "diwan-presentation-font-scale";
const STORAGE_LINE_SPACING = "diwan-presentation-line-spacing";

function readPersistedIndex(key: string, max: number, fallback: number): number {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  const parsed = raw === null ? NaN : parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed >= max) return fallback;
  return parsed;
}

/**
 * وضع العرض (Presentation Mode) -- شاشة كاملة للقراءة المركّزة تعرض أبيات
 * القصيدة فقط، بلا شرح، بلا بيانات توقيت أو ثقة، وبلا أي أدوات تحكم أو شريط
 * جانبي، مع إمكانية ضبط حجم الخط وتباعد الأسطر حسب راحة القارئ.
 * الهدف تفريغ الشاشة من كل عنصر يشتّت القارئ عن النص نفسه.
 */
export const FocusModeView: React.FC<FocusModeViewProps> = ({
  poem,
  activeVerseIndex,
  isPlaying,
  onTogglePlay,
  onSeekToVerse,
  onExit,
}) => {
  const [fontIndex, setFontIndex] = useState(() => readPersistedIndex(STORAGE_FONT_SCALE, FONT_SCALES.length, 1));
  const [spacingIndex, setSpacingIndex] = useState(() =>
    readPersistedIndex(STORAGE_LINE_SPACING, LINE_SPACINGS.length, 1)
  );

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_FONT_SCALE, String(fontIndex));
    }
  }, [fontIndex]);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_LINE_SPACING, String(spacingIndex));
    }
  }, [spacingIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  const cycleSpacing = () => setSpacingIndex((i) => (i + 1) % LINE_SPACINGS.length);
  const fontScale = FONT_SCALES[fontIndex];
  const lineSpacing = LINE_SPACINGS[spacingIndex];

  useEffect(() => {
    if (activeVerseIndex < 0) return;
    const el = document.getElementById(`focus-verse-${activeVerseIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeVerseIndex]);

  return (
    <div className="fixed inset-0 z-50 bg-charcoal-950 text-parchment-100 flex flex-col">
      {/* Minimal exit affordance */}
      <button
        type="button"
        onClick={onExit}
        title="الخروج من وضع العرض (Esc)"
        className="absolute top-6 left-6 md:top-8 md:left-8 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-ink-500 hover:text-parchment-100 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
      >
        <X className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Presentation controls: text size + line spacing */}
      <div className="absolute top-6 right-6 md:top-8 md:right-8 z-10 flex items-center gap-1 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl select-none">
        <button
          type="button"
          onClick={() => setFontIndex((i) => Math.max(0, i - 1))}
          disabled={fontIndex === 0}
          title="تصغير الخط"
          className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-ink-500 hover:text-parchment-100 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span
          className="text-[11px] font-bold text-ink-500 px-1 w-14 text-center font-sans"
          title="حجم الخط"
        >
          {fontScale.label}
        </span>
        <button
          type="button"
          onClick={() => setFontIndex((i) => Math.min(FONT_SCALES.length - 1, i + 1))}
          disabled={fontIndex === FONT_SCALES.length - 1}
          title="تكبير الخط"
          className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-ink-500 hover:text-parchment-100 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <button
          type="button"
          onClick={cycleSpacing}
          title={`تباعد الأسطر: ${lineSpacing.label}`}
          className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-ink-500 hover:text-parchment-100 hover:bg-white/10 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
        >
          <MoveVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-16 py-20 md:py-24 scroll-smooth">
        <div className="max-w-3xl mx-auto w-full space-y-12 md:space-y-16">
          <h1 className="font-poetry text-2xl md:text-4xl text-center text-accent-700/80 select-none mb-4 md:mb-8 font-bold">
            {poem.title}
          </h1>

          {poem.verses.map((verse, index) => (
            <div
              key={verse.id}
              id={`focus-verse-${index}`}
              onClick={() => onSeekToVerse(verse)}
              className="flex flex-col items-center justify-center gap-3 md:gap-4 cursor-pointer select-text py-2"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSeekToVerse(verse);
                }
              }}
            >
              <p
                className={cn(
                  "font-poetry text-center transition-all duration-500",
                  fontScale.textClass,
                  lineSpacing.leadingClass,
                  index === activeVerseIndex
                    ? "text-parchment-100 font-bold text-shadow-gold scale-105"
                    : "text-ink-600 hover:text-ink-400"
                )}
              >
                {verse.firstHemistich}
              </p>
              <p
                className={cn(
                  "font-poetry text-center transition-all duration-500",
                  fontScale.textClass,
                  lineSpacing.leadingClass,
                  index === activeVerseIndex
                    ? "text-parchment-100 font-bold text-shadow-gold scale-105"
                    : "text-ink-600 hover:text-ink-400"
                )}
              >
                {verse.secondHemistich}
              </p>
            </div>
          ))}
          
          <div className="h-32" /> {/* Bottom padding to allow last verse to scroll to center */}
        </div>
      </div>

      {/* Single, unobtrusive playback affordance */}
      <button
        type="button"
        onClick={onTogglePlay}
        title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-14 h-14 md:w-16 md:h-16 rounded-full bg-charcoal-900/60 hover:bg-charcoal-800/80 border border-white/10 backdrop-blur-xl flex items-center justify-center text-accent-700 transition-all cursor-pointer shadow-[0_0_30px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 hover:scale-110 active:scale-95"
      >
        {isPlaying ? <Pause className="w-6 h-6 md:w-7 md:h-7" /> : <Play className="w-6 h-6 md:w-7 md:h-7 mr-[-2px]" />}
      </button>
    </div>
  );
};
