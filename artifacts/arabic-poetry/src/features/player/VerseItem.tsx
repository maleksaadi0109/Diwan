import React, { useEffect, useState } from "react";
import { Verse, VerseExplanationItem } from "@/types";
import { cn, formatTime, toArabicDigits } from "@/lib/utils";
import { Info, CheckCircle2, Volume2, Sparkles, Trash2, AlertTriangle, X, BookOpenText, Pencil, Save, Loader2, Share2 } from "lucide-react";

export type VerseExplanationStatus = "idle" | "loading" | "loaded" | "empty" | "error";

interface VerseItemProps {
  verse: Verse;
  isActive: boolean;
  isSelected?: boolean;
  onSeekToVerse: (verse: Verse) => void;
  onSelectVerse?: (verse: Verse) => void;
  onDeleteVerse?: (verse: Verse) => void;
  onOpenExplanation?: (verse: Verse) => void;
  onEditVerse?: (verseId: string, firstHemistich: string, secondHemistich: string) => Promise<void> | void;
  onShareVerse?: (verse: Verse) => void;
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
  onEditVerse,
  onShareVerse,
  onWordClick,
  verseRef,
  explanationItems,
  explanationStatus = "idle",
  explanationError,
  onRetryExplanation,
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFirst, setEditFirst] = useState(verse.firstHemistich);
  const [editSecond, setEditSecond] = useState(verse.secondHemistich);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const startEditing = () => {
    setEditFirst(verse.firstHemistich);
    setEditSecond(verse.secondHemistich);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const saveEditing = async () => {
    if (!onEditVerse) return;
    if (!editFirst.trim() || !editSecond.trim()) {
      setEditError("لا يمكن ترك شطر البيت فارغًا.");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await onEditVerse(verse.id, editFirst, editSecond);
      setIsEditing(false);
    } catch (err: unknown) {
      setEditError((err as Error).message || "تعذر حفظ تعديل البيت.");
    } finally {
      setIsSavingEdit(false);
    }
  };
  const alignment = verse.alignment;
  const items = explanationItems ?? verse.explanations ?? [];
  const hasExplanation = Boolean(verse.explanation || items.length > 0 || explanationStatus !== "idle");

  useEffect(() => {
    setShowExplanation(false);
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
        className="inline-block mx-1 hover:text-accent-500 hover:scale-105 cursor-pointer transition-all duration-150 border-b border-transparent hover:border-accent-700 pb-0.5"
        title="انقر لعرض المعنى من المعجم"
      >
        {w}
      </span>
    ));
  };

  return (
    <div
      ref={verseRef}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (onSelectVerse) onSelectVerse(verse);
        else onSeekToVerse(verse);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        // Ignore activation bubbled up from a nested interactive control
        // (explanation toggle, edit, delete, etc.) -- those handle their own
        // activation and must not also seek/select this verse.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (onSelectVerse) onSelectVerse(verse);
        else onSeekToVerse(verse);
      }}
      onDoubleClick={() => {
        if (onOpenExplanation) onOpenExplanation(verse);
      }}
      title={onOpenExplanation ? "انقر نقرًا مزدوجًا لعرض شرح البيت في نافذة مستقلة" : undefined}
      className={cn(
        "group relative p-6 md:p-8 rounded-3xl border transition-all duration-300 cursor-pointer select-text font-sans outline-none focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900",
        isActive
          ? "bg-charcoal-850 border-accent-700 shadow-xl shadow-accent-700/5 ring-1 ring-accent-700/50 z-10"
          : isSelected
          ? "bg-charcoal-850/80 border-white/20 shadow-lg"
          : "bg-charcoal-900/60 hover:bg-charcoal-850/70 border-white/5 hover:border-white/10"
      )}
    >
      {/* Decorative gold indicator for active verse */}
      {isActive && (
        <div className="absolute inset-y-4 right-0 w-1.5 bg-gradient-to-b from-accent-400 via-accent-700 to-accent-600 rounded-l-full shadow-md shadow-accent-700/50" />
      )}

      {/* Verse Header Info */}
      <div className="flex items-center justify-between mb-4 select-none text-xs tracking-wide">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-300 font-mono border",
              isActive
                ? "bg-accent-700 text-charcoal-950 border-accent-700 shadow-md shadow-accent-700/30"
                : "bg-white/5 text-ink-500 border-white/10 group-hover:border-white/20 group-hover:text-parchment-100"
            )}
          >
            {toArabicDigits(verse.orderIndex)}
          </span>

          {alignment && (
            <span
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-mono ltr-num border transition-colors flex items-center gap-1.5",
                isActive
                  ? "bg-accent-700/15 text-accent-500 border-accent-700/40"
                  : "bg-white/5 text-ink-500 border-white/5"
              )}
            >
              <Volume2 className={cn("w-3 h-3", isActive ? "text-accent-700" : "text-ink-600")} />
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
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : alignment.confidence >= 0.65
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-crimson-500/10 text-crimson-400 border-crimson-500/20"
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
                "px-2.5 py-1 text-xs font-bold flex items-center gap-1 border rounded-lg transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700",
                showExplanation
                  ? "bg-white/10 text-parchment-100 border-white/20"
                  : "bg-transparent text-ink-500 hover:text-parchment-100 border-white/10 hover:bg-white/5"
              )}
              title="عرض الشرح والمعنى"
            >
              <Info className={cn("w-3.5 h-3.5", showExplanation ? "text-parchment-100" : "text-accent-700")} />
              <span>الشرح</span>
            </button>
          )}

          {onEditVerse && !isEditing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
              className="p-1.5 rounded-lg text-ink-600 hover:text-accent-500 hover:bg-white/5 border border-transparent hover:border-white/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent-700"
              title="تعديل نص البيت"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenExplanation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenExplanation(verse);
              }}
              className="p-1.5 rounded-lg text-ink-600 hover:text-accent-500 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700"
              title="فتح شرح البيت في نافذة مستقلة"
            >
              <BookOpenText className="w-3.5 h-3.5" />
            </button>
          )}

          {onShareVerse && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShareVerse(verse);
              }}
              className="p-1.5 rounded-lg text-ink-600 hover:text-accent-500 hover:bg-white/5 border border-transparent hover:border-white/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent-700"
              title="مشاركة هذا البيت كصورة"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {onDeleteVerse && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(true);
              }}
              className="p-1.5 rounded-lg text-ink-600 hover:text-crimson-400 hover:bg-crimson-500/10 border border-transparent hover:border-crimson-500/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crimson-500"
              title="حذف هذا البيت من القصيدة"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Poetic Verse with Two Hemistichs */}
      <div className="my-4">
        {isEditing ? (
          <div
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter saves without leaving the text inputs (a bare
              // Enter is left alone since it's meaningful inside a text
              // field); Escape cancels. Both work while an input has focus,
              // unlike the global letter shortcuts which are suppressed there.
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (!isSavingEdit) saveEditing();
              } else if (e.key === "Escape") {
                e.preventDefault();
                if (!isSavingEdit) cancelEditing();
              }
            }}
            className="space-y-3"
          >
            <div className="flex flex-col md:flex-row items-stretch gap-3 w-full min-w-0">
              <input
                type="text"
                value={editFirst}
                onChange={(e) => setEditFirst(e.target.value)}
                placeholder="الصدر"
                dir="rtl"
                autoFocus
                className="flex-1 min-w-0 w-full bg-charcoal-950/50 text-parchment-100 placeholder-ink-600 border border-white/10 focus:border-accent-700 focus:outline-none rounded-2xl px-4 py-3 text-lg md:text-xl font-poetry text-center transition-colors"
              />
              <input
                type="text"
                value={editSecond}
                onChange={(e) => setEditSecond(e.target.value)}
                placeholder="العجز"
                dir="rtl"
                className="flex-1 min-w-0 w-full bg-charcoal-950/50 text-parchment-100 placeholder-ink-600 border border-white/10 focus:border-accent-700 focus:outline-none rounded-2xl px-4 py-3 text-lg md:text-xl font-poetry text-center transition-colors"
              />
            </div>
            {editError && <p className="text-xs text-crimson-400 font-sans text-center">{editError}</p>}
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isSavingEdit}
                title="إلغاء (Esc)"
                className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-ink-600 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveEditing}
                disabled={isSavingEdit}
                title="حفظ التعديل (Ctrl+Enter)"
                className="px-4 py-1.5 rounded-xl bg-accent-700 hover:bg-accent-600 text-charcoal-950 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>حفظ التعديل</span>
              </button>
            </div>
            <p className="text-[10px] text-ink-600 font-sans text-center">
              Ctrl+Enter للحفظ &nbsp;•&nbsp; Esc للإلغاء
            </p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 px-2 py-2 relative">
            {/* الصدر (First Hemistich) */}
            <div className="flex-1 text-center md:text-right">
              <span
                className={cn(
                  "font-poetry text-2xl md:text-[30px] leading-[2.3] tracking-wide transition-all duration-300",
                  isActive
                    ? "text-parchment-100 font-bold text-shadow-gold"
                    : isSelected
                    ? "text-parchment-100 font-bold"
                    : "text-ink-600 group-hover:text-parchment-100"
                )}
              >
                {renderWords(verse.firstHemistich)}
              </span>
            </div>

            {/* فاصل الشطرين */}
            <div className="shrink-0 flex items-center justify-center select-none transition-colors">
              <Sparkles className="w-4 h-4 text-accent-700/50" />
            </div>

            {/* العجز (Second Hemistich) */}
            <div className="flex-1 text-center md:text-left">
              <span
                className={cn(
                  "font-poetry text-2xl md:text-[30px] leading-[2.3] tracking-wide transition-all duration-300",
                  isActive
                    ? "text-parchment-100 font-bold text-shadow-gold"
                    : isSelected
                    ? "text-parchment-100 font-bold"
                    : "text-ink-600 group-hover:text-parchment-100"
                )}
              >
                {renderWords(verse.secondHemistich)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Verse Explanation / Meanings */}
      {showExplanation && (verse.explanation || items.length > 0) && (
        <div className="mt-6 pt-5 border-t border-white/5 text-sm md:text-base text-ink-600 leading-loose space-y-3 select-text font-sans animate-fade-in">
          {verse.explanation && (
            <p className="bg-charcoal-950/40 p-4 md:p-5 rounded-2xl border border-white/5">
              <span className="text-accent-700 font-bold ml-2 text-sm md:text-[15px] tracking-wide">الشرح:</span>
              <span className="text-parchment-100">{verse.explanation}</span>
            </p>
          )}

          {items.map((item, idx) => (
            <div key={idx} className="bg-charcoal-950/40 p-4 md:p-5 rounded-2xl border border-white/5 space-y-1.5">
              <span className="text-accent-700 font-bold block text-sm md:text-[15px] tracking-wide">{item.sourceTitle || item.author || "المعجم"}:</span>
              <p className="text-parchment-100">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {showConfirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 bg-charcoal-900/95 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-between animate-fade-in border border-crimson-500/30 shadow-2xl cursor-default"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 text-crimson-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold text-sm">تأكيد حذف البيت</span>
            </div>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="text-ink-500 hover:text-parchment-100 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-ink-600 leading-relaxed my-3 font-sans">
            هل أنت متأكد من رغبتك في حذف البيت رقم <strong className="text-parchment-100">{toArabicDigits(verse.orderIndex)}</strong> نهائيًا؟ سيتم حذف محاذاته الصوتية وشرحه أيضًا، وستُعاد ترقيم الأبيات التالية.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-ink-600 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirmDelete(false);
                onDeleteVerse?.(verse);
              }}
              className="px-4 py-1.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold transition-all shadow-lg shadow-crimson-500/20 flex items-center gap-1.5"
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
