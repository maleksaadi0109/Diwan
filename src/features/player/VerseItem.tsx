import React, { useState } from "react";
import { Verse } from "@/types";
import { cn, formatTime, toArabicDigits } from "@/lib/utils";
import { Info, Sparkles, CheckCircle2 } from "lucide-react";

interface VerseItemProps {
  verse: Verse;
  isActive: boolean;
  onSeekToVerse: (verse: Verse) => void;
  onWordClick?: (word: string) => void;
  verseRef?: (el: HTMLDivElement | null) => void;
}

export const VerseItem: React.FC<VerseItemProps> = ({
  verse,
  isActive,
  onSeekToVerse,
  onWordClick,
  verseRef,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const alignment = verse.alignment;

  const renderWords = (text: string) => {
    const words = text.split(/\s+/).filter(Boolean);
    return words.map((w, idx) => (
      <span
        key={idx}
        onClick={(e) => {
          if (onWordClick) {
            e.stopPropagation();
            onWordClick(w.replace(/[،؛؟.!]/g, ""));
          }
        }}
        className="inline-block mx-1 hover:text-gold-400 hover:underline cursor-pointer transition-colors"
        title="انقر لعرض المعنى من المعجم"
      >
        {w}
      </span>
    ));
  };

  return (
    <div
      ref={verseRef}
      onClick={() => onSeekToVerse(verse)}
      className={cn(
        "group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-text",
        isActive
          ? "bg-charcoal-850/95 border-gold-500/60 shadow-lg shadow-gold-500/5 ring-1 ring-gold-500/40"
          : "bg-charcoal-900/50 hover:bg-charcoal-850/70 border-charcoal-800/80 hover:border-charcoal-700"
      )}
    >
      {/* Verse Index & Status indicator */}
      <div className="flex items-center justify-between text-xs mb-3 select-none">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors",
              isActive
                ? "bg-gold-500 text-charcoal-950 shadow-sm"
                : "bg-charcoal-800 text-parchment-400 group-hover:bg-charcoal-700"
            )}
          >
            {toArabicDigits(verse.orderIndex)}
          </span>

          {alignment && (
            <span className="text-[11px] text-parchment-400 font-mono ltr-num flex items-center gap-1">
              <span>{formatTime(alignment.startMs)}</span>
              <span>-</span>
              <span>{formatTime(alignment.endMs)}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {alignment && (
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1",
                alignment.confidence >= 0.8
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : alignment.confidence >= 0.65
                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              )}
              title={`دقة المحاذاة: ${Math.round(alignment.confidence * 100)}%`}
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>{Math.round(alignment.confidence * 100)}%</span>
            </span>
          )}

          {verse.explanation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowExplanation(!showExplanation);
              }}
              className={cn(
                "p-1 rounded-md transition-colors text-xs flex items-center gap-1",
                showExplanation
                  ? "bg-gold-500/20 text-gold-300"
                  : "text-parchment-400 hover:text-parchment-200 hover:bg-charcoal-800"
              )}
              title="عرض الشرح والمعنى"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="text-[10px]">شرح</span>
            </button>
          )}
        </div>
      </div>

      {/* Poetic Verse with Two Hemistichs */}
      <div className="my-2">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 px-2 py-1">
          {/* الصدر (First Hemistich) */}
          <div className="flex-1 text-center md:text-right">
            <span
              className={cn(
                "font-poetry text-xl md:text-2xl leading-relaxed tracking-wide transition-all",
                isActive
                  ? "text-gold-300 font-bold text-shadow-gold"
                  : "text-parchment-100 group-hover:text-parchment-50"
              )}
            >
              {renderWords(verse.firstHemistich)}
            </span>
          </div>

          {/* فاصل الشطرين */}
          <div className="shrink-0 flex items-center justify-center text-gold-500/40 select-none">
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          {/* العجز (Second Hemistich) */}
          <div className="flex-1 text-center md:text-left">
            <span
              className={cn(
                "font-poetry text-xl md:text-2xl leading-relaxed tracking-wide transition-all",
                isActive
                  ? "text-gold-300 font-bold text-shadow-gold"
                  : "text-parchment-100 group-hover:text-parchment-50"
              )}
            >
              {renderWords(verse.secondHemistich)}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Explanation Panel */}
      {showExplanation && verse.explanation && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 pt-3 border-t border-charcoal-800 text-xs text-parchment-300 bg-charcoal-950/40 p-3 rounded-xl border border-charcoal-800/60 flex items-start gap-2 animate-fadeIn"
        >
          <Info className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-gold-400 block mb-0.5">الشرح والمعاني:</span>
            <p className="leading-normal">{verse.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
};
