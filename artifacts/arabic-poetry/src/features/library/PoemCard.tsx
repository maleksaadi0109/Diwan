import React from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { Mic, BookOpen, ChevronLeft, Feather, Sparkles } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PoemCardProps {
  poem: Poem;
  onOpenPoem: (poem: Poem) => void;
}

export const PoemCard: React.FC<PoemCardProps> = ({ poem, onOpenPoem }) => {
  const hasAudio = poem.recordings.length > 0;
  const firstVerse = poem.verses[0];

  return (
    <div
      onClick={() => onOpenPoem(poem)}
      className="group relative bg-[#13161D]/90 border border-white/[0.08] hover:border-[#D4AF37]/40 rounded-2xl p-6 cursor-pointer transition-all duration-500 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_36px_rgba(212,175,55,0.15)] hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden backdrop-blur-xl"
    >
      {/* Subtle top-right ambient gold flare */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-[#D4AF37]/10 to-transparent rounded-bl-full -z-10 transition-transform duration-700 group-hover:scale-125 pointer-events-none" />

      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="gold" size="sm">
              العصر ال{poem.era}
            </Badge>
            <Badge variant="charcoal" size="sm">
              بحر {poem.bahr}
            </Badge>
          </div>
          {hasAudio && (
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium font-sans shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <Mic className="w-3 h-3 text-emerald-400" strokeWidth={2} />
              <span>تسجيل صوتي</span>
            </span>
          )}
        </div>

        {/* Title & Poet */}
        <h3 className="font-poetry text-2xl font-bold text-[#F8F9FA] group-hover:text-[#F3E19C] transition-colors mb-2 line-clamp-1 leading-normal tracking-wide">
          {poem.title}
        </h3>
        <p className="text-[13px] font-medium text-[#A0AAB7] mb-5 flex items-center gap-2 font-sans">
          <Feather className="w-3.5 h-3.5 text-[#D4AF37]/70" />
          <span>{poem.poet.name}</span>
        </p>

        {/* First verse sample preview */}
        {firstVerse && (
          <div className="bg-black/30 border border-white/[0.06] rounded-xl px-4 py-4 mb-5 relative before:absolute before:inset-y-3 before:right-0 before:w-1 before:bg-gradient-to-b before:from-[#F3E19C] before:to-[#D4AF37] before:rounded-l-md group-hover:border-[#D4AF37]/20 transition-colors">
            <p className="font-poetry text-[17px] text-[#E9ECEF] text-center leading-[2] tracking-wide">
              <span className="group-hover:text-[#FFF5DC] transition-colors">{firstVerse.firstHemistich}</span>
              <span className="text-[#D4AF37]/70 mx-3 font-sans text-xs select-none">✦</span>
              <span className="group-hover:text-[#FFF5DC] transition-colors">{firstVerse.secondHemistich}</span>
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-[13px] text-[#A0AAB7] font-sans tracking-wide">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#D4AF37]/80" strokeWidth={1.75} />
            <span><strong className="text-[#F8F9FA] px-0.5">{toArabicDigits(poem.versesCount)}</strong> أبيات</span>
          </span>
          <span className="text-white/20">•</span>
          <span>الرويّ: <strong className="text-[#F3E19C]">{poem.rhyme}</strong></span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPoem(poem);
          }}
          className="flex items-center gap-1.5 text-[#F3E19C] hover:text-[#FFF5DC] transition-colors font-semibold group/btn text-xs bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 px-3 py-1.5 rounded-lg border border-[#D4AF37]/20"
        >
          <span>فتح</span>
          <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-x-1" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
