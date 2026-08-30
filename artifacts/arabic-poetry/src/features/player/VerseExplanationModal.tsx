import React from "react";
import { Verse, VerseExplanationItem } from "@/types";
import { toArabicDigits } from "@/lib/utils";
import { BookOpenText, X, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { VerseExplanationStatus } from "./VerseItem";

interface VerseExplanationModalProps {
  verse: Verse | null;
  items?: VerseExplanationItem[];
  status?: VerseExplanationStatus;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
}

export const VerseExplanationModal: React.FC<VerseExplanationModalProps> = ({
  verse,
  items = [],
  status = "idle",
  error,
  onRetry,
  onClose,
}) => {
  if (!verse) return null;

  const allItems = items.length > 0 ? items : verse.explanations || [];
  const hasContent = Boolean(verse.explanation) || allItems.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/75 backdrop-blur-sm p-4 select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-charcoal-950 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-charcoal-900 shrink-0">
          <div className="flex items-center gap-2.5 text-parchment-100 min-w-0">
            <BookOpenText className="w-5 h-5 text-accent-700 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold font-sans truncate">شرح البيت رقم {toArabicDigits(verse.orderIndex)}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-parchment-100 p-1.5 rounded-xl hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 select-text">
          {/* Verse text */}
          <div className="bg-black/30 rounded-2xl border border-white/5 px-6 py-6 text-center">
            <p className="font-poetry text-2xl md:text-[28px] leading-[2.3] tracking-wide text-parchment-100">
              <span>{verse.firstHemistich}</span>
              <span className="text-accent-700 mx-3 text-base align-middle">
                <Sparkles className="w-4 h-4 inline text-accent-700/70" />
              </span>
              <span>{verse.secondHemistich}</span>
            </p>
          </div>

          {/* Loading state */}
          {status === "loading" && (
            <div className="text-center py-8 text-sm font-bold text-ink-500 font-sans flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-accent-700" />
              <span>جاري جلب الشرح...</span>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-center space-y-3">
              <AlertCircle className="w-5 h-5 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-300 font-sans font-bold">
                {error || "تعذر جلب شرح هذا البيت."}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-parchment-100 transition-colors inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              )}
            </div>
          )}

          {/* Explanation content */}
          {status !== "loading" && (
            <div className="space-y-4">
              {verse.explanation && (
                <div className="bg-black/30 p-5 rounded-2xl border border-white/5 text-sm md:text-base text-ink-500 leading-loose font-sans">
                  <span className="text-accent-700 font-bold block mb-2 text-sm tracking-wide">الشرح:</span>
                  <p>{verse.explanation}</p>
                </div>
              )}

              {allItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-black/30 p-5 rounded-2xl border border-white/5 text-sm md:text-base text-ink-500 leading-loose font-sans space-y-2"
                >
                  <span className="text-accent-700 font-bold block text-sm tracking-wide">
                    {item.sourceTitle || item.author || "المعجم"}
                    {item.explanationType === "rhetorical" && " — تحليل بلاغي"}
                  </span>
                  <p>{item.text}</p>
                </div>
              ))}

              {status !== "error" && !hasContent && (
                <div className="text-center py-8 text-xs font-bold text-ink-600 font-sans">
                  لا يوجد شرح متوفر لهذا البيت حتى الآن.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-charcoal-900 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-parchment-100 text-xs font-bold rounded-xl transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
