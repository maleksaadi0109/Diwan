import React, { useEffect, useState } from "react";
import { Verse, VerseExplanationItem } from "@/types";
import { cn, formatTime, toArabicDigits } from "@/lib/utils";
import { Info, CheckCircle2, Volume2, Sparkles, Trash2, AlertTriangle, X, BookOpenText } from "lucide-react";

export type VerseExplanationStatus = "idle" | "loading" | "loaded" | "empty" | "error";

interface VerseItemProps {
  verse: Verse;
  isActive: boolean;
  isSelected?: boolean;
  onSeekToVerse: (verse: Verse) => void;
  onSelectVerse?: (verse: Verse) => void;
  onDeleteVerse?: (verse: Verse) => void;
  onOpenExplanation?: (verse: Verse) => void;
  explanationItems?: VerseExplanationItem[];
  explanationStatus?: VerseExplanationStatus;
  explanationError?: string | null;
  onRetryExplanation?: () => void;
  onWordClick?: (word: string) => void;
  verseRef?: (el: HTMLDivElement | null) => void;
}

export const VerseItem: React.FC<VerseItemProps> = ({
  verse,
  isActive,
  isSelected = false,
  onSeekToVerse,
  onSelectVerse,
  onDeleteVerse,
  onOpenExplanation,
  onWordClick,
  verseRef,
  explanationItems,
  explanationStatus = "idle",
  explanationError,
  onRetryExplanation,
}) => {
  const [showExplanation, setShowExplanation] = useState(true);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
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
        className="inline-block mx-1 hover:text-[#F3E19C] hover:scale-105 cursor-pointer transition-all duration-150 border-b border-transparent hover:border-[#D4AF37] pb-0.5"
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
      onDoubleClick={() => {
        if (onOpenExplanation) onOpenExplanation(verse);
      }}
      title={onOpenExplanation ? "انقر نقرًا مزدوجًا لعرض شرح البيت في نافذة مستقلة" : undefined}
      className={cn(
        "group relative p-6 md:p-8 rounded-3xl border transition-all duration-300 cursor-pointer select-text font-sans",
        isActive
          ? "bg-[#14171E] border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.15)] ring-1 ring-[#D4AF37]/50 z-10"
          : isSelected
          ? "bg-[#14171E]/80 border-white/20 shadow-lg"
          : "bg-[#0E1015]/60 hover:bg-[#14171E]/70 border-white/[0.06] hover:border-white/10"
      )}
    >
      {/* Decorative gold indicator for active verse */}
      {isActive && (
        <div className="absolute inset-y-4 right-0 w-1.5 bg-gradient-to-b from-[#F3E19C] via-[#D4AF37] to-[#B89225] rounded-l-full shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
      )}

      {/* Verse Header Info */}
      <div className="flex items-center justify-between mb-4 select-none text-xs tracking-wide">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-300 font-mono border",
              isActive
                ? "bg-[#D4AF37] text-[#0A0C10] border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.4)]"
                : "bg-white/[0.04] text-[#A0AAB7] border-white/10 group-hover:border-white/20 group-hover:text-[#F8F9FA]"
            )}
          >
            {toArabicDigits(verse.orderIndex)}
          </span>

          {alignment && (
            <span
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-mono ltr-num border transition-colors flex items-center gap-1.5",
                isActive
                  ? "bg-[#D4AF37]/15 text-[#F3E19C] border-[#D4AF37]/40"
                  : "bg-white/[0.03] text-[#A0AAB7] border-white/5"
              )}
            >
              <Volume2 className="w-3 h-3 text-[#D4AF37]" />
              <span>
                {formatTime(alignment.startMs)} - {formatTime(alignment.endMs)}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {alignment && (
            <span
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 border rounded-lg",
                alignment.confidence >= 0.8
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : alignment.confidence >= 0.65
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
              )}
              title={`دقة المحاذاة: ${Math.round(alignment.confidence * 100)}%`}
            >
              <CheckCircle2 className="w-3 h-3 strokeWidth={2.5}" />
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
                "px-2.5 py-1 text-xs font-bold flex items-center gap-1 border rounded-lg transition-all cursor-pointer",
                showExplanation
                  ? "bg-white/10 text-[#F8F9FA] border-white/20"
                  : "bg-transparent text-[#A0AAB7] hover:text-[#F8F9FA] border-white/10 hover:bg-white/[0.05]"
              )}
              title="عرض الشرح والمعنى"
            >
              <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>الشرح</span>
            </button>
          )}

          {onOpenExplanation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenExplanation(verse);
              }}
              className="p-1.5 rounded-lg text-[#6C7A8C] hover:text-[#F3E19C] hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all cursor-pointer"
              title="فتح شرح البيت في نافذة مستقلة"
            >
              <BookOpenText className="w-3.5 h-3.5" />
            </button>
          )}

          {onDeleteVerse && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(true);
              }}
              className="p-1.5 rounded-lg text-[#6C7A8C] hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              title="حذف هذا البيت من القصيدة"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Poetic Verse with Two Hemistichs */}
      <div className="my-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 px-2 py-2 relative">
          {/* الصدر (First Hemistich) */}
          <div className="flex-1 text-center md:text-right">
            <span
              className={cn(
                "font-poetry text-2xl md:text-[30px] leading-[2.3] tracking-wide transition-all duration-300",
                isActive
                  ? "text-[#F8F9FA] font-bold text-shadow-gold"
                  : isSelected
                  ? "text-[#F8F9FA] font-bold"
                  : "text-[#E9ECEF] group-hover:text-[#F8F9FA]"
              )}
            >
              {renderWords(verse.firstHemistich)}
            </span>
          </div>

          {/* فاصل الشطرين */}
          <div className="shrink-0 flex items-center justify-center select-none text-[#D4AF37] transition-colors">
            <Sparkles className="w-4 h-4 text-[#D4AF37]/70" />
          </div>

          {/* العجز (Second Hemistich) */}
          <div className="flex-1 text-center md:text-left">
            <span
              className={cn(
                "font-poetry text-2xl md:text-[30px] leading-[2.3] tracking-wide transition-all duration-300",
                isActive
                  ? "text-[#F8F9FA] font-bold text-shadow-gold"
                  : isSelected
                  ? "text-[#F8F9FA] font-bold"
                  : "text-[#E9ECEF] group-hover:text-[#F8F9FA]"
              )}
            >
              {renderWords(verse.secondHemistich)}
            </span>
          </div>
        </div>
      </div>

      {/* Verse Explanation / Meanings */}
      {showExplanation && (verse.explanation || items.length > 0) && (
        <div className="mt-6 pt-5 border-t border-white/[0.08] text-sm md:text-base text-[#C7CDD6] leading-loose space-y-3 select-text font-sans">
          {verse.explanation && (
            <p className="bg-black/30 p-4 md:p-5 rounded-2xl border border-white/[0.05]">
              <span className="text-[#D4AF37] font-bold ml-2 text-sm md:text-[15px] tracking-wide">الشرح:</span>
              {verse.explanation}
            </p>
          )}

          {items.map((item, idx) => (
            <div key={idx} className="bg-black/30 p-4 md:p-5 rounded-2xl border border-white/[0.05] space-y-1.5">
              <span className="text-[#D4AF37] font-bold block text-sm md:text-[15px] tracking-wide">{item.sourceTitle || item.author || "المعجم"}:</span>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {showConfirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 bg-[#0E1015]/95 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-between animate-in fade-in duration-200 border border-rose-500/40 shadow-2xl"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold text-sm">تأكيد حذف البيت</span>
            </div>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="text-[#6C7A8C] hover:text-[#F8F9FA] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#CED4DA] leading-relaxed my-3 font-sans">
            هل أنت متأكد من رغبتك في حذف البيت رقم <strong className="text-[#F8F9FA]">{toArabicDigits(verse.orderIndex)}</strong> نهائيًا؟ سيتم حذف محاذاته الصوتية وشرحه أيضًا، وستُعاد ترقيم الأبيات التالية.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-[#CED4DA] transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirmDelete(false);
                onDeleteVerse?.(verse);
              }}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-[#F8F9FA] text-xs font-bold transition-all shadow-[0_0_12px_rgba(225,29,72,0.4)] flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف نهائي</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
