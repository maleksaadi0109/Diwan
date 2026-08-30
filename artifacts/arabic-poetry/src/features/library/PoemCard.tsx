import React, { useState } from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { Mic, BookOpen, ChevronLeft, Feather, Trash2, AlertTriangle, X } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PoemCardProps {
  poem: Poem;
  onOpenPoem: (poem: Poem) => void;
  onDeletePoem?: (poemId: string) => void;
}

export const PoemCard: React.FC<PoemCardProps> = ({ poem, onOpenPoem, onDeletePoem }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const hasAudio = poem.recordings.length > 0;
  const firstVerse = poem.verses[0];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeletePoem) {
      onDeletePoem(poem.id);
    }
    setShowConfirmDelete(false);
  };

  return (
    <div
      onClick={() => onOpenPoem(poem)}
      className="group bg-[#14171E]/90 hover:bg-[#181C25] border border-white/[0.08] hover:border-[#D4AF37]/50 rounded-3xl p-6 cursor-pointer transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] flex flex-col justify-between relative backdrop-blur-xl select-none"
    >
      <div>
        {/* Cover image, when available (e.g. imported from YouTube) */}
        {poem.coverImageUrl && (
          <div className="w-full h-32 mb-4 rounded-2xl overflow-hidden border border-white/[0.08] bg-black/40">
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

        {/* Header Badges & Actions */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#D4AF37]/15 text-[#F3E19C] border border-[#D4AF37]/30">
              العصر ال{poem.era}
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-white/[0.05] text-[#CED4DA] border border-white/10">
              بحر {poem.bahr}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasAudio && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-lg border border-emerald-500/30 text-emerald-300 font-bold bg-emerald-500/10 shadow-sm">
                <Mic className="w-3 h-3 text-emerald-400" />
                <span>صوتي</span>
              </span>
            )}

            {onDeletePoem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDelete(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-xl text-[#6C7A8C] hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                title="حذف القصيدة من الديوان"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title & Poet */}
        <h3 className="font-poetry text-xl md:text-2xl font-bold text-[#F8F9FA] group-hover:text-[#F3E19C] transition-colors mb-1.5 line-clamp-1 leading-normal">
          {poem.title}
        </h3>
        <p className="text-xs font-medium text-[#A0AAB7] mb-5 flex items-center gap-1.5 font-sans">
          <Feather className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>{poem.poet.name}</span>
        </p>

        {/* First verse sample preview */}
        {firstVerse && (
          <div className="bg-black/40 border border-white/[0.06] group-hover:border-white/10 rounded-2xl px-4 py-3.5 mb-5 relative transition-colors shadow-inner">
            <p className="font-poetry text-base md:text-lg text-[#CED4DA] group-hover:text-[#F8F9FA] text-center leading-[2] tracking-wide">
              <span>{firstVerse.firstHemistich}</span>
              <span className="text-[#D4AF37] mx-2 font-sans text-xs select-none">✦</span>
              <span>{firstVerse.secondHemistich}</span>
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#A0AAB7] font-sans">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span><strong className="text-[#F8F9FA] px-0.5">{toArabicDigits(poem.versesCount)}</strong> أبيات</span>
          </span>
          <span className="text-white/20">•</span>
          <span>الرويّ: <strong className="text-[#F8F9FA]">{poem.rhyme}</strong></span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPoem(poem);
          }}
          className="flex items-center gap-1.5 text-[#D4AF37] hover:text-[#0A0C10] font-bold text-xs bg-transparent hover:bg-gradient-to-r hover:from-[#D4AF37] hover:to-[#B89225] px-3.5 py-1.5 border border-[#D4AF37]/50 rounded-xl transition-all group/btn cursor-pointer shadow-sm"
        >
          <span>تصفح</span>
          <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-x-1" strokeWidth={2.5} />
        </button>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      {showConfirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 bg-[#0E1015]/95 backdrop-blur-md rounded-3xl p-6 flex flex-col justify-between animate-in fade-in duration-200 border border-rose-500/40 shadow-2xl"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold text-sm">تأكيد حذف القصيدة</span>
            </div>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="text-[#6C7A8C] hover:text-[#F8F9FA] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#CED4DA] leading-relaxed my-3 font-sans">
            هل أنت متأكد من رغبتك في حذف قصيدة <strong className="text-[#F8F9FA]">"{poem.title}"</strong> وجميع تسجيلاتها ومحاذاتها نهائيًا؟
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
              onClick={handleDelete}
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
