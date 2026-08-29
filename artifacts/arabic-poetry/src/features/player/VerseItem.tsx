import React, { useEffect, useState, memo } from "react";
import { Verse, VerseExplanationItem } from "@/types";
import { cn, formatTime, toArabicDigits } from "@/lib/utils";
import { Info, Sparkles, CheckCircle2, Loader2, RefreshCw, Volume2 } from "lucide-react";

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
        className="inline-block mx-1 hover:text-[#F3E19C] hover:scale-105 cursor-pointer transition-all duration-200 border-b border-transparent hover:border-[#D4AF37]/50 pb-0.5"
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
        "group relative p-6 md:p-8 rounded-3xl border transition-all duration-500 cursor-pointer select-text font-sans backdrop-blur-xl",
        isActive
          ? "bg-gradient-to-br from-[#1C1F28]/95 via-[#181B22]/95 to-[#241E15]/95 border-[#D4AF37]/60 shadow-[0_12px_40px_rgba(212,175,55,0.18)] ring-1 ring-[#D4AF37]/40 z-10 scale-[1.01]"
          : isSelected
          ? "bg-[#181B22]/90 border-white/20 shadow-xl"
          : "bg-[#12151C]/75 hover:bg-[#161922]/90 border-white/[0.07] hover:border-[#D4AF37]/30 hover:shadow-lg"
      )}
    >
      {/* Decorative Gold Corners on Active */}
      {(isActive || isSelected) && (
        <>
          <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-[#D4AF37] rounded-tr-md opacity-90 shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
          <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-[#D4AF37] rounded-tl-md opacity-90 shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
          <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-[#D4AF37] rounded-br-md opacity-90 shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
          <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-[#D4AF37] rounded-bl-md opacity-90 shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
        </>
      )}

      {/* Verse Header Info */}
      <div className="flex items-center justify-between mb-5 select-none text-[13px] tracking-wide">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-300 font-mono",
              isActive
                ? "bg-gradient-to-r from-[#D4AF37] to-[#B89225] text-[#0A0C10] shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                : "bg-white/[0.06] text-[#CED4DA] group-hover:bg-[#D4AF37]/15 group-hover:text-[#F3E19C] border border-white/10"
            )}
          >
            {toArabicDigits(verse.orderIndex)}
          </span>

          {alignment && (
            <span className={cn(
              "font-mono ltr-num flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors duration-300 border",
              isActive
                ? "bg-[#D4AF37]/10 text-[#F3E19C] border-[#D4AF37]/30 shadow-sm"
                : "bg-white/[0.03] text-[#A0AAB7] border-white/[0.06] group-hover:text-[#CED4DA]"
            )}>
              <span>{formatTime(alignment.startMs)}</span>
              <span className="opacity-50">—</span>
              <span>{formatTime(alignment.endMs)}</span>
            </span>
          )}

          {isActive && (
            <span className="flex items-center gap-1.5 text-xs text-[#D4AF37] font-medium bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-full border border-[#D4AF37]/20 animate-pulse">
              <Volume2 className="w-3.5 h-3.5" />
              <span>يُتلى الآن</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {alignment && (
            <span
              className={cn(
                "px-3 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition-colors duration-300",
                alignment.confidence >= 0.8
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                  : alignment.confidence >= 0.65
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
              )}
              title={`دقة المحاذاة: ${Math.round(alignment.confidence * 100)}%`}
            >
              <CheckCircle2 className="w-3 h-3" />
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
                "px-3 py-1 rounded-lg transition-colors duration-300 flex items-center gap-1.5 border text-[11px] font-medium",
                showExplanation
                  ? "bg-white/[0.08] text-[#F8F9FA] border-white/20"
                  : "bg-transparent text-[#A0AAB7] hover:text-[#F8F9FA] border-transparent hover:bg-white/[0.06]"
              )}
              title="عرض الشرح والمعنى"
            >
              <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>الشرح</span>
            </button>
          )}
        </div>
      </div>

      {/* Poetic Verse with Two Hemistichs */}
      <div className="my-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 px-2 py-3 relative">
          {/* الصدر (First Hemistich) */}
          <div className="flex-1 text-center md:text-right">
            <span
              className={cn(
                "font-poetry text-2xl md:text-3xl leading-[2.2] tracking-wide transition-all duration-300",
                isActive
                  ? "text-[#FFF8E7] font-bold drop-shadow-[0_2px_16px_rgba(212,175,55,0.3)]"
                  : isSelected
                  ? "text-[#F8F9FA] font-bold"
                  : "text-[#E9ECEF] group-hover:text-white"
              )}
            >
              {renderWords(verse.firstHemistich)}
            </span>
          </div>

          {/* فاصل الشطرين الذهبي */}
          <div className="shrink-0 flex items-center justify-center select-none text-[#D4AF37]/60 group-hover:text-[#D4AF37] transition-colors">
            <span className="text-sm font-poetry">✦</span>
          </div>

          {/* العجز (Second Hemistich) */}
          <div className="flex-1 text-center md:text-left">
            <span
              className={cn(
                "font-poetry text-2xl md:text-3xl leading-[2.2] tracking-wide transition-all duration-300",
                isActive
                  ? "text-[#FFF8E7] font-bold drop-shadow-[0_2px_16px_rgba(212,175,55,0.3)]"
                  : isSelected
                  ? "text-[#F8F9FA] font-bold"
                  : "text-[#E9ECEF] group-hover:text-white"
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
          className="mt-6 pt-5 border-t border-white/[0.08] text-[13px] text-[#CED4DA] bg-black/40 p-5 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner relative overflow-hidden backdrop-blur-md"
        >
          <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-[#D4AF37] to-[#8C6D14] rounded-r-md" />
          <Info className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-[#F3E19C] block mb-2 font-poetry text-lg">الشرح والمعاني</span>
            {explanationStatus === "loading" ? (
              <div className="flex items-center gap-3 text-[#A0AAB7] p-3">
                <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                <span className="tracking-wide text-xs">جاري استخراج شرح البيت...</span>
              </div>
            ) : explanationStatus === "error" ? (
              <div className="space-y-3 p-4 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <p className="leading-relaxed text-rose-300 text-xs">{explanationError || "تعذر تحميل الشرح."}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetryExplanation?.();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/25 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
                </button>
              </div>
            ) : items.length > 0 ? (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="border-b border-white/[0.06] last:border-0 pb-4 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#A0AAB7] mb-2 font-medium">
                      <span className="text-[#F3E19C] bg-[#D4AF37]/15 px-2.5 py-0.5 rounded-md border border-[#D4AF37]/20">
                        {item.explanationType === "classical" ? "شرح تراثي" : "معنى البيت"}
                      </span>
                      {item.author && <span>— {item.author}</span>}
                      {item.sourceTitle && <span>({item.sourceTitle})</span>}
                    </div>
                    <p className="leading-[2] text-[15px] font-poetry text-[#F8F9FA]">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : verse.explanation ? (
              <p className="leading-[2] text-[15px] font-poetry text-[#F8F9FA]">{verse.explanation}</p>
            ) : (
              <p className="leading-relaxed text-[#A0AAB7] text-xs">لا يتوفر شرح لهذا البيت في المصدر.</p>
            )}
            {items.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/[0.06] text-[11px] text-[#6C7A8C] font-sans flex items-center justify-between">
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
