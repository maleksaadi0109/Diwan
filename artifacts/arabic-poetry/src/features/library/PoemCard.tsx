import React from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { Mic, BookOpen, ChevronLeft } from "lucide-react";
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
      className="group relative bg-sand-50 border border-sand-300 rounded-xl p-6 cursor-pointer transition-all duration-300 shadow-[0_2px_8px_-2px_rgba(31,34,39,0.05)] hover:shadow-[0_8px_24px_-4px_rgba(31,34,39,0.08)] hover:-translate-y-1 flex flex-col justify-between overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-crimson-800/5 rounded-bl-full -z-10 transition-transform duration-500 group-hover:scale-110"></div>
      
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="gold" size="sm">
              العصر ال{poem.era}
            </Badge>
            <Badge variant="charcoal" size="sm">
              بحر {poem.bahr}
            </Badge>
          </div>
          {hasAudio && (
            <Badge variant="success" size="sm" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Mic className="w-3 h-3" strokeWidth={2} />
              تسجيل صوتي
            </Badge>
          )}
        </div>

        {/* Title & Poet */}
        <h3 className="font-poetry text-2xl font-bold text-ink-900 group-hover:text-crimson-800 transition-colors mb-2 line-clamp-1 leading-normal">
          {poem.title}
        </h3>
        <p className="text-[13px] font-medium text-ink-500 mb-6 flex items-center gap-1.5 font-sans">
           <span className="w-4 h-[1px] bg-sand-400"></span>
           {poem.poet.name}
        </p>

        {/* First verse sample preview */}
        {firstVerse && (
          <div className="bg-sand-100/50 border border-sand-200 rounded-lg px-4 py-5 mb-5 relative before:absolute before:inset-y-3 before:right-0 before:w-1 before:bg-sand-300 before:rounded-l-md">
            <p className="font-poetry text-[17px] text-ink-800 text-center leading-[1.8]">
              <span>{firstVerse.firstHemistich}</span>
              <span className="text-crimson-800/40 mx-4 font-sans text-sm select-none">✺</span>
              <span>{firstVerse.secondHemistich}</span>
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-sand-200 flex items-center justify-between text-[13px] text-ink-500 font-sans tracking-wide">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-ink-400" strokeWidth={1.5} />
            <span><strong className="text-ink-700 px-0.5">{toArabicDigits(poem.versesCount)}</strong> أبيات</span>
          </span>
          <span className="text-sand-400">•</span>
          <span>الرويّ: <strong className="text-ink-700">{poem.rhyme}</strong></span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPoem(poem);
          }}
          className="flex items-center gap-1 text-crimson-700 hover:text-crimson-900 transition-colors font-semibold group/btn"
        >
          <span>فتح</span>
          <ChevronLeft className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
