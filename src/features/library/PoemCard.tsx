import React from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { PlayCircle, Mic, BookOpen } from "lucide-react";
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
      className="group relative bg-charcoal-900/90 hover:bg-charcoal-850 border border-charcoal-800 hover:border-gold-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="gold" size="sm">
              العصر ال{poem.era}
            </Badge>
            <Badge variant="charcoal" size="sm">
              بحر {poem.bahr}
            </Badge>
          </div>
          {hasAudio && (
            <Badge variant="success" size="sm">
              <Mic className="w-3 h-3" />
              تسجيل صوتي
            </Badge>
          )}
        </div>

        {/* Title & Poet */}
        <h3 className="font-poetry text-xl font-bold text-parchment-100 group-hover:text-gold-300 transition-colors mb-1 line-clamp-1">
          {poem.title}
        </h3>
        <p className="text-xs font-semibold text-gold-500/90 mb-3">
          {poem.poet.name}
        </p>

        {/* First verse sample preview */}
        {firstVerse && (
          <div className="bg-charcoal-950/60 border border-charcoal-800/80 rounded-xl p-3 mb-4">
            <p className="font-poetry text-sm text-parchment-200 text-center leading-relaxed">
              <span>{firstVerse.firstHemistich}</span>
              <span className="text-gold-500/60 mx-2 font-sans text-xs">...</span>
              <span>{firstVerse.secondHemistich}</span>
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-charcoal-800/80 flex items-center justify-between text-xs text-parchment-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-parchment-400" />
            <span>{toArabicDigits(poem.versesCount)} أبيات</span>
          </span>
          <span className="text-charcoal-700">•</span>
          <span>الرويّ: {poem.rhyme}</span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPoem(poem);
          }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 border border-gold-500/30 transition-all text-xs font-medium"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>فتح</span>
        </button>
      </div>
    </div>
  );
};
