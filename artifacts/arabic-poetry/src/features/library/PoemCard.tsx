import React from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { Mic, BookOpen, ChevronLeft, Feather } from "lucide-react";
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
      className="group bg-paper-100 border border-paper-400 hover:border-accent-700 rounded-none p-6 cursor-pointer transition-colors shadow-sm hover:shadow-md flex flex-col justify-between relative"
    >
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
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 border border-ink-600 text-ink-700 font-bold font-ui bg-paper-200">
              <Mic className="w-3 h-3 text-ink-700" strokeWidth={2} />
              <span>صوتي</span>
            </span>
          )}
        </div>

        {/* Title & Poet */}
        <h3 className="font-heading text-2xl font-bold text-ink-900 group-hover:text-accent-700 transition-colors mb-2 line-clamp-1 leading-normal">
          {poem.title}
        </h3>
        <p className="text-[14px] font-medium text-ink-600 mb-5 flex items-center gap-2 font-ui">
          <Feather className="w-3.5 h-3.5 text-accent-700" />
          <span>{poem.poet.name}</span>
        </p>

        {/* First verse sample preview */}
        {firstVerse && (
          <div className="bg-paper-200 border border-paper-400 rounded-none px-4 py-4 mb-5 relative before:absolute before:inset-y-0 before:right-0 before:w-1 before:bg-accent-700 transition-colors">
            <p className="font-poetry text-[19px] text-ink-800 font-bold text-center leading-[2] tracking-wide">
              <span>{firstVerse.firstHemistich}</span>
              <span className="text-accent-700 mx-3 font-ui text-xs select-none">✦</span>
              <span>{firstVerse.secondHemistich}</span>
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-paper-400 flex items-center justify-between text-[14px] text-ink-600 font-ui tracking-wide">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-ink-500" strokeWidth={1.5} />
            <span><strong className="text-ink-800 px-0.5">{toArabicDigits(poem.versesCount)}</strong> أبيات</span>
          </span>
          <span className="text-paper-400">•</span>
          <span>الرويّ: <strong className="text-ink-800">{poem.rhyme}</strong></span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPoem(poem);
          }}
          className="flex items-center gap-1.5 text-accent-700 hover:text-paper-100 font-bold font-ui text-[13px] bg-transparent hover:bg-accent-700 px-3 py-1.5 border border-accent-700 rounded-none transition-colors group/btn"
        >
          <span>تصفح</span>
          <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-x-1" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
