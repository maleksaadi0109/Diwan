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
        className="inline-block mx-1 hover:text-crimson-700 cursor-pointer transition-colors border-b border-transparent hover:border-crimson-700/40 pb-1"
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
        "group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer select-text font-sans",
        isActive || isSelected
          ? "bg-sand-50 border-crimson-800/40 shadow-[0_8px_24px_-8px_rgba(106,26,34,0.15)] ring-1 ring-crimson-800/20 z-10 scale-[1.01]"
          : "bg-sand-100/50 hover:bg-sand-50 border-sand-300 hover:border-sand-400 hover:shadow-md"
      )}
    >
      {/* Decorative corners */}
      {(isActive || isSelected) && (
        <>
          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-crimson-800/30 rounded-tr-sm"></div>
          <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-crimson-800/30 rounded-tl-sm"></div>
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-crimson-800/30 rounded-br-sm"></div>
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-crimson-800/30 rounded-bl-sm"></div>
        </>
      )}

      {/* Verse Index & Status indicator */}
      <div className="flex items-center justify-between mb-5 select-none text-[13px] tracking-wide">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
              isActive || isSelected
                ? "bg-crimson-800 text-sand-50 shadow-sm shadow-crimson-800/20"
                : "bg-sand-200 text-ink-700 group-hover:bg-sand-300 group-hover:text-ink-900"
            )}
          >
            {toArabicDigits(verse.orderIndex)}
          </span>

          {alignment && (
            <span className={cn(
              "font-mono ltr-num flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors duration-300",
              isActive || isSelected ? "bg-crimson-800/5 text-crimson-800" : "bg-sand-200/50 text-ink-500 group-hover:text-ink-700"
            )}>
              <span>{formatTime(alignment.startMs)}</span>
              <span>—</span>
              <span>{formatTime(alignment.endMs)}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {alignment && (
            <span
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 border transition-colors duration-300",
                alignment.confidence >= 0.8
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : alignment.confidence >= 0.65
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              )}
              title={`دقة المحاذاة: ${Math.round(alignment.confidence * 100)}%`}
            >
              <CheckCircle2 className="w-3 h-3" />
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
                "px-2.5 py-1 rounded-md transition-colors duration-300 flex items-center gap-1.5 border text-[11px] font-medium",
                showExplanation
                  ? "bg-sand-200/80 text-ink-800 border-sand-300"
                  : "bg-transparent text-ink-500 hover:text-ink-800 border-transparent hover:bg-sand-200 hover:border-sand-300"
              )}
              title="عرض الشرح والمعنى"
            >
              <Info className="w-3.5 h-3.5" />
              <span>الشرح</span>
            </button>
          )}
        </div>
      </div>

      {/* Poetic Verse with Two Hemistichs */}
      <div className="my-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 px-4 py-2 relative">
          {/* الصدر (First Hemistich) */}
          <div className="flex-1 text-center md:text-right">
            <span
              className={cn(
                "font-poetry text-2xl md:text-3xl leading-[1.8] transition-all duration-300",
                isActive
                  ? "text-crimson-800 font-bold drop-shadow-[0_2px_8px_rgba(106,26,34,0.15)]"
                  : isSelected
                  ? "text-ink-950 font-bold"
                  : "text-ink-900 group-hover:text-ink-950"
              )}
            >
              {renderWords(verse.firstHemistich)}
            </span>
          </div>

          {/* فاصل الشطرين */}
          <div className="shrink-0 flex items-center justify-center text-sand-400 select-none group-hover:text-crimson-800/30 transition-colors">
            <Sparkles className="w-4 h-4" strokeWidth={1.5} />
          </div>

          {/* العجز (Second Hemistich) */}
          <div className="flex-1 text-center md:text-left">
            <span
              className={cn(
                "font-poetry text-2xl md:text-3xl leading-[1.8] transition-all duration-300",
                isActive
                  ? "text-crimson-800 font-bold drop-shadow-[0_2px_8px_rgba(106,26,34,0.15)]"
                  : isSelected
                  ? "text-ink-950 font-bold"
                  : "text-ink-900 group-hover:text-ink-950"
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
          className="mt-6 pt-5 border-t border-sand-300/80 text-[13px] text-ink-800 bg-sand-100/50 p-5 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-1 h-full bg-sand-300/80 rounded-r-md"></div>
          <Info className="w-5 h-5 text-sand-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-ink-900 block mb-2 font-poetry text-lg">الشرح والمعاني</span>
            {explanationStatus === "loading" ? (
              <div className="flex items-center gap-3 text-ink-500 p-4">
                <Loader2 className="w-4 h-4 animate-spin text-crimson-800" />
                <span className="tracking-wide">جاري استخراج شرح البيت...</span>
              </div>
            ) : explanationStatus === "error" ? (
              <div className="space-y-3 p-4 bg-rose-50/50 rounded-lg border border-rose-200">
                <p className="leading-relaxed text-rose-800">{explanationError || "تعذر تحميل الشرح."}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetryExplanation?.();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
                </button>
              </div>
            ) : items.length > 0 ? (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="border-b border-sand-300/60 last:border-0 pb-4 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500 mb-2 font-medium">
                      <span className="text-crimson-800 bg-crimson-800/5 px-2 py-0.5 rounded">{item.explanationType === "classical" ? "شرح تراثي" : "معنى البيت"}</span>
                      {item.author && <span>— {item.author}</span>}
                      {item.sourceTitle && <span>({item.sourceTitle})</span>}
                    </div>
                    <p className="leading-[1.8] text-[15px] font-poetry text-ink-900">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : verse.explanation ? (
              <p className="leading-[1.8] text-[15px] font-poetry text-ink-900">{verse.explanation}</p>
            ) : (
              <p className="leading-relaxed text-ink-500">لا يتوفر شرح لهذا البيت في المصدر.</p>
            )}
            {items.length > 0 && (
              <div className="mt-4 pt-3 border-t border-sand-200/80 text-[11px] text-ink-400 font-sans flex items-center justify-between">
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
