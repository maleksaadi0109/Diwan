import React, { useEffect, useState, memo } from "react";
import { Verse, VerseExplanationItem } from "@/types";
import { cn, formatTime, toArabicDigits } from "@/lib/utils";
import { Info, Sparkles, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export type VerseExplanationStatus = "idle" | "loading" | "loaded" | "empty" | "error";

interface VerseItemProps {
  verse: Verse;
  isActive: boolean;
  isSelected?: boolean;
  onSeekToVerse: (verse: Verse) => void;
  onSelectVerse?: (verse: Verse) => void;
  explanationItems?: VerseExplanationItem[];
  explanationStatus?: VerseExplanationStatus;
  explanationError?: string | null;
  onRetryExplanation?: () => void;
  onWordClick?: (word: string) => void;
  verseRef?: (el: HTMLDivElement | null) => void;
}

const VerseItemComponent: React.FC<VerseItemProps> = ({
  verse,
  isActive,
  isSelected = false,
  onSeekToVerse,
  onSelectVerse,
  onWordClick,
  verseRef,
  explanationItems,
  explanationStatus = "idle",
  explanationError,
  onRetryExplanation,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const alignment = verse.alignment;
  const items = explanationItems ?? verse.explanations ?? [];
  const hasExplanation = Boolean(verse.explanation || items.length > 0 || explanationStatus !== "idle");

  useEffect(() => {
    if (!isSelected) setShowExplanation(false);
  }, [isSelected]);

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
      onClick={() => {
        onSeekToVerse(verse);
        onSelectVerse?.(verse);
        setShowExplanation(true);
      }}
      className={cn(
        "group relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer select-text",
        isActive || isSelected
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

          {hasExplanation && (
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
                "font-poetry text-xl md:text-2xl leading-relaxed tracking-wide transition-colors",
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
                "font-poetry text-xl md:text-2xl leading-relaxed tracking-wide transition-colors",
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
      {showExplanation && hasExplanation && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3 pt-3 border-t border-charcoal-800 text-xs text-parchment-300 bg-charcoal-950/40 p-3 rounded-xl border border-charcoal-800/60 flex items-start gap-2 animate-fadeIn"
        >
          <Info className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-gold-400 block mb-1">الشرح والمعاني:</span>
            {explanationStatus === "loading" ? (
              <div className="flex items-center gap-2 text-parchment-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري تحميل شرح البيت من ميزان العرب...</span>
              </div>
            ) : explanationStatus === "error" ? (
              <div className="space-y-2">
                <p className="leading-normal text-rose-300">{explanationError || "تعذر تحميل الشرح."}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetryExplanation?.();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200"
                >
                  <RefreshCw className="w-3 h-3" /> إعادة المحاولة
                </button>
              </div>
            ) : items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="border-b border-charcoal-800/80 last:border-0 pb-2 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gold-300 mb-1">
                      <span>{item.explanationType === "classical" ? "شرح تراثي" : "معنى البيت"}</span>
                      {item.author && <span className="text-parchment-400">— {item.author}</span>}
                      {item.sourceTitle && <span className="text-parchment-500">({item.sourceTitle})</span>}
                    </div>
                    <p className="leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : verse.explanation ? (
              <p className="leading-normal">{verse.explanation}</p>
            ) : (
              <p className="leading-normal text-parchment-400">لا يتوفر شرح لهذا البيت في المصدر.</p>
            )}
            {items.length > 0 && (
              <div className="mt-3 pt-2 border-t border-charcoal-800 text-[10px] text-parchment-500">
                المصدر: ميزان العرب
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const VerseItem = memo(VerseItemComponent, (prev, next) => {
  return (
    prev.isActive === next.isActive &&
    prev.isSelected === next.isSelected &&
    prev.verse.id === next.verse.id &&
    prev.verse.text === next.verse.text &&
    prev.verse.alignment?.startMs === next.verse.alignment?.startMs &&
    prev.verse.alignment?.endMs === next.verse.alignment?.endMs &&
    prev.explanationStatus === next.explanationStatus &&
    prev.explanationError === next.explanationError &&
    (prev.explanationItems?.length || prev.verse.explanations?.length || 0) ===
      (next.explanationItems?.length || next.verse.explanations?.length || 0) &&
    (prev.explanationItems?.[0]?.text || prev.verse.explanations?.[0]?.text || "") ===
      (next.explanationItems?.[0]?.text || next.verse.explanations?.[0]?.text || "")
  );
});
