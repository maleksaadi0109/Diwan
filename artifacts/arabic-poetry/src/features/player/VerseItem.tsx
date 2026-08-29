import React, { useEffect, useState, memo } from "react";
import { Verse, VerseExplanationItem } from "@/types";
import { cn, formatTime, toArabicDigits } from "@/lib/utils";
import { Info, CheckCircle2, Loader2, RefreshCw, Volume2 } from "lucide-react";

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
  const [showExplanation, setShowExplanation] = useState(true);
  const alignment = verse.alignment;
  const items = explanationItems ?? verse.explanations ?? [];
  const hasExplanation = Boolean(verse.explanation || items.length > 0 || explanationStatus !== "idle");

  useEffect(() => {
    setShowExplanation(true);
  }, [verse.id]);

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
        className="inline-block mx-1 hover:text-accent-700 hover:scale-105 cursor-pointer transition-all duration-200 border-b border-transparent hover:border-accent-700 pb-0.5"
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
        if (onSelectVerse) onSelectVerse(verse);
        else onSeekToVerse(verse);
        setShowExplanation(true);
      }}
      className={cn(
        "group relative p-6 md:p-8 rounded-none border transition-colors cursor-pointer select-text font-ui",
        isActive
          ? "bg-paper-100 border-accent-700 shadow-md ring-1 ring-accent-700 z-10"
          : isSelected
          ? "bg-paper-100 border-paper-500 shadow-sm"
          : "bg-transparent hover:bg-paper-100 border-transparent hover:border-paper-400"
      )}
    >
      {/* Decorative margin line for active */}
      {isActive && (
        <div className="absolute inset-y-0 right-0 w-1.5 bg-accent-700" />
      )}

      {/* Verse Header Info */}
      <div className="flex items-center justify-between mb-6 select-none text-[14px] tracking-wide">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "w-8 h-8 rounded-none flex items-center justify-center font-bold text-sm transition-colors duration-300 font-mono border",
              isActive
                ? "bg-accent-700 text-paper-100 border-accent-700 shadow-sm"
                : "bg-transparent text-ink-600 border-ink-400 group-hover:border-ink-600 group-hover:text-ink-800"
            )}
          >
            {toArabicDigits(verse.orderIndex)}
          </span>

          {alignment && (
            <span className={cn(
              "font-mono ltr-num flex items-center gap-2 px-3 py-1 text-[13px] font-medium border rounded-none transition-colors",
              isActive
                ? "bg-paper-300 text-accent-700 border-paper-400 shadow-sm"
                : "bg-transparent text-ink-500 border-transparent group-hover:border-paper-400 group-hover:bg-paper-200"
            )}>
              <span>{formatTime(alignment.startMs)}</span>
              <span className="opacity-50">—</span>
              <span>{formatTime(alignment.endMs)}</span>
            </span>
          )}

          {isActive && (
            <span className="flex items-center gap-1.5 text-[13px] text-accent-700 font-bold bg-paper-200 px-3 py-0.5 border border-accent-700/30 animate-pulse rounded-none">
              <Volume2 className="w-4 h-4" />
              <span>يُتلى الآن</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {alignment && (
            <span
              className={cn(
                "px-3 py-1 text-[12px] font-bold flex items-center gap-1.5 border rounded-none shadow-sm",
                alignment.confidence >= 0.8
                  ? "bg-green-50 text-green-800 border-green-800"
                  : alignment.confidence >= 0.65
                  ? "bg-amber-50 text-amber-800 border-amber-800"
                  : "bg-red-50 text-red-800 border-red-800"
              )}
              title={`دقة المحاذاة: ${Math.round(alignment.confidence * 100)}%`}
            >
              <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
              <span className="ltr-num">{Math.round(alignment.confidence * 100)}%</span>
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
                "px-3 py-1 text-[13px] font-bold flex items-center gap-1.5 border rounded-none transition-colors",
                showExplanation
                  ? "bg-paper-300 text-ink-900 border-paper-500"
                  : "bg-transparent text-ink-600 hover:text-ink-900 border-ink-400 hover:bg-paper-200"
              )}
              title="عرض الشرح والمعنى"
            >
              <Info className="w-4 h-4 text-ink-700" strokeWidth={2} />
              <span>الشرح</span>
            </button>
          )}
        </div>
      </div>

      {/* Poetic Verse with Two Hemistichs */}
      <div className="my-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 px-2 py-3 relative">
          {/* الصدر (First Hemistich) */}
          <div className="flex-1 text-center md:text-right">
            <span
              className={cn(
                "font-poetry text-3xl md:text-[34px] leading-[2.4] tracking-wide transition-colors duration-300",
                isActive
                  ? "text-ink-900 font-bold"
                  : isSelected
                  ? "text-ink-900 font-bold"
                  : "text-ink-800 group-hover:text-ink-900 group-hover:font-bold"
              )}
            >
              {renderWords(verse.firstHemistich)}
            </span>
          </div>

          {/* فاصل الشطرين */}
          <div className="shrink-0 flex items-center justify-center select-none text-accent-700 transition-colors">
            <span className="text-xl font-poetry">✦</span>
          </div>

          {/* العجز (Second Hemistich) */}
          <div className="flex-1 text-center md:text-left">
            <span
              className={cn(
                "font-poetry text-3xl md:text-[34px] leading-[2.4] tracking-wide transition-colors duration-300",
                isActive
                  ? "text-ink-900 font-bold"
                  : isSelected
                  ? "text-ink-900 font-bold"
                  : "text-ink-800 group-hover:text-ink-900 group-hover:font-bold"
              )}
            >
              {renderWords(verse.secondHemistich)}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Explanation Panel */}
      {showExplanation && (hasExplanation || isSelected) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-6 pt-5 border-t border-paper-400 text-[14px] text-ink-800 bg-paper-200 p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm relative overflow-hidden rounded-none"
        >
          <Info className="w-5 h-5 text-accent-700 shrink-0 mt-1" />
          <div className="flex-1">
            <span className="font-bold text-accent-700 block mb-3 font-heading text-xl">الشرح والمعاني</span>
            {explanationStatus === "loading" ? (
              <div className="flex items-center gap-3 text-ink-600 p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="tracking-wide font-medium">جاري استخراج شرح البيت...</span>
              </div>
            ) : explanationStatus === "error" ? (
              <div className="space-y-3 p-4 bg-red-50 rounded-none border border-red-800">
                <p className="leading-relaxed text-red-800 font-medium">{explanationError || "تعذر تحميل الشرح."}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetryExplanation?.();
                  }}
                  className="inline-flex items-center gap-2 border border-red-800 bg-transparent px-4 py-2 text-[13px] font-bold text-red-800 hover:bg-red-800 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> إعادة المحاولة
                </button>
              </div>
            ) : items.length > 0 ? (
              <div className="space-y-5">
                {items.map((item) => (
                  <div key={item.id} className="border-b border-paper-400 last:border-0 pb-4 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-600 mb-3 font-medium">
                      <span className="text-ink-800 bg-paper-300 font-bold px-3 py-1 border border-paper-400 rounded-none">
                        {item.explanationType === "classical" ? "شرح تراثي" : "معنى البيت"}
                      </span>
                      {item.author && <span>— {item.author}</span>}
                      {item.sourceTitle && <span>({item.sourceTitle})</span>}
                    </div>
                    <p className="leading-[2.2] text-[18px] font-poetry text-ink-900">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : verse.explanation ? (
              <p className="leading-[2.2] text-[18px] font-poetry text-ink-900">{verse.explanation}</p>
            ) : (
              <p className="leading-relaxed text-ink-600">لا يتوفر شرح لهذا البيت في المصدر.</p>
            )}
            {items.length > 0 && (
              <div className="mt-5 pt-3 border-t border-paper-400 text-[12px] font-bold text-ink-500 flex items-center justify-between">
                <span>المصدر: ميزان العرب</span>
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
