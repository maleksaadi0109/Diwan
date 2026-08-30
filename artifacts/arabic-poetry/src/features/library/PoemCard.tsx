import React, { useState } from "react";
import { Poem } from "@/types";
import { Mic, BookOpen, ChevronLeft, Feather, Trash2, AlertTriangle, X, ListPlus, Check } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PoemCardProps {
  poem: Poem;
  onOpenPoem: (poem: Poem) => void;
  onDeletePoem?: (poemId: string) => void;
  onAddToPlaylist?: (poem: Poem) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (poemId: string) => void;
}

export const PoemCard: React.FC<PoemCardProps> = ({
  poem,
  onOpenPoem,
  onDeletePoem,
  onAddToPlaylist,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const hasAudio = poem.recordings.length > 0;
  const firstVerse = poem.verses[0];

  const handleDelete = () => {
    if (onDeletePoem) {
      onDeletePoem(poem.id);
    }
    setShowConfirmDelete(false);
  };

  const handleCardActivate = () => {
    if (selectionMode) {
      onToggleSelect?.(poem.id);
    } else {
      onOpenPoem(poem);
    }
  };

  const hasActions = !selectionMode && (onAddToPlaylist || onDeletePoem);

  return (
    <div
      className={`group bg-charcoal-850 hover:bg-charcoal-800 border rounded-3xl transition-all duration-300 shadow-md hover:shadow-xl flex flex-col relative backdrop-blur-xl select-none ${
        isSelected ? "border-accent-700 ring-1 ring-accent-700/50 bg-charcoal-800" : "border-white/5 hover:border-accent-700/30"
      }`}
    >
      {selectionMode && (
        <div
          className={`absolute -top-2.5 -right-2.5 z-20 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shadow-lg pointer-events-none ${
            isSelected
              ? "bg-accent-700 border-accent-700 text-charcoal-950"
              : "bg-charcoal-900 border-white/20 text-transparent"
          }`}
        >
          <Check className="w-4 h-4" strokeWidth={3} />
        </div>
      )}

      {/* Standalone action buttons -- siblings of the open/select button below,
          never nested inside it, so they remain independently focusable and
          keyboard-activatable without also triggering card activation. */}
      {hasActions && (
        <div className="absolute top-5 md:top-6 start-5 md:start-6 z-10 flex items-center gap-1.5">
          {onAddToPlaylist && (
            <button
              type="button"
              onClick={() => onAddToPlaylist(poem)}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-xl text-ink-500 hover:text-accent-700 hover:bg-accent-700/10 border border-transparent transition-all cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:outline-none bg-charcoal-850"
              title="إضافة إلى قائمة تشغيل"
              aria-label="إضافة إلى قائمة تشغيل"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          )}

          {onDeletePoem && (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded-xl text-ink-500 hover:text-crimson-500 hover:bg-crimson-500/10 border border-transparent transition-all cursor-pointer focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-crimson-500 focus-visible:outline-none bg-charcoal-850"
              title="حذف القصيدة من الديوان"
              aria-label="حذف القصيدة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleCardActivate}
        className="flex-1 flex flex-col justify-between text-start p-5 md:p-6 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 rounded-3xl"
        aria-label={`قصيدة ${poem.title} للشاعر ${poem.poet.name}`}
        aria-pressed={selectionMode ? isSelected : undefined}
      >
        <div>
          {/* Cover image, when available (e.g. imported from YouTube) */}
          {poem.coverImageUrl && (
            <div className="w-full h-28 md:h-32 mb-4 rounded-2xl overflow-hidden border border-white/5 bg-charcoal-950/50">
              <img
                src={poem.coverImageUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          {/* Header Badges (action buttons render as siblings above, not here) */}
          <div className={`flex items-center justify-between gap-2 mb-4 ${hasActions ? "pe-14" : ""}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] md:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-accent-700/10 text-accent-500 border border-accent-700/20">
                العصر ال{poem.era}
              </span>
              <span className="text-[10px] md:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/5 text-ink-600 border border-white/10">
                بحر {poem.bahr}
              </span>
            </div>

            {hasAudio && (
              <span className="inline-flex items-center gap-1 text-[10px] md:text-[11px] px-2.5 py-0.5 rounded-full border border-emerald-500/20 text-emerald-400 font-bold bg-emerald-500/10 shadow-sm" aria-label="يحتوي على تسجيل صوتي">
                <Mic className="w-3 h-3" />
                <span>صوتي</span>
              </span>
            )}
          </div>

          {/* Title & Poet */}
          <h3 className="font-poetry text-xl md:text-2xl font-bold text-parchment-100 group-hover:text-accent-400 transition-colors mb-2 line-clamp-1 leading-normal">
            {poem.title}
          </h3>
          <p className="text-xs font-medium text-ink-500 mb-5 flex items-center gap-1.5 font-sans">
            <Feather className="w-3.5 h-3.5 text-accent-700" />
            <span>{poem.poet.name}</span>
          </p>

          {/* First verse sample preview */}
          {firstVerse && (
            <div className="bg-charcoal-900/60 border border-white/5 group-hover:border-white/10 rounded-2xl px-4 py-3.5 mb-5 relative transition-colors shadow-inner">
              <p className="font-poetry text-base md:text-lg text-ink-600 group-hover:text-parchment-100 text-center leading-[2] tracking-wide">
                <span>{firstVerse.firstHemistich}</span>
                <span className="text-accent-700 mx-2 font-sans text-[10px] select-none">✦</span>
                <span>{firstVerse.secondHemistich}</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[11px] md:text-xs text-ink-500 font-sans">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-accent-700" />
              <span><strong className="text-parchment-100 px-0.5">{toArabicDigits(poem.versesCount)}</strong> أبيات</span>
            </span>
            <span className="text-white/10">•</span>
            <span>الرويّ: <strong className="text-parchment-100">{poem.rhyme}</strong></span>
          </div>

          <span className="flex items-center gap-1 text-accent-600 group-hover:text-parchment-100 font-bold px-2 py-1 transition-all">
            <span>تصفح</span>
            <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" strokeWidth={2.5} />
          </span>
        </div>
      </button>

      {/* Delete Confirmation Modal Overlay */}
      {showConfirmDelete && (
        <div className="absolute inset-0 z-30 bg-charcoal-900/95 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-between animate-fade-in border border-crimson-500/30 shadow-2xl cursor-default">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-crimson-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold text-sm">تأكيد الحذف</span>
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="text-ink-500 hover:text-parchment-100 p-1 rounded-lg hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-accent-700"
              aria-label="إلغاء"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-ink-600 leading-relaxed my-3 font-sans">
            حذف قصيدة <strong className="text-parchment-100">"{poem.title}"</strong> وجميع تسجيلاتها ومحاذاتها نهائيًا؟
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowConfirmDelete(false)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-ink-600 transition-colors focus-visible:ring-2 focus-visible:ring-accent-700"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-1.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-crimson-500"
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
