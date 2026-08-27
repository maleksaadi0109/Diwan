import React from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { User, Music, Mic, Sparkles } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PoemMetadataDrawerProps {
  poem: Poem;
  isOpen: boolean;
  onToggle: () => void;
}

export const PoemMetadataDrawer: React.FC<PoemMetadataDrawerProps> = ({
  poem,
  isOpen,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-charcoal-900 border-r border-charcoal-800 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 select-none">
      {/* Poet Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold uppercase tracking-wider">
          <User className="w-4 h-4" />
          <span>عن الشاعر</span>
        </div>
        <div className="bg-charcoal-850 p-4 rounded-xl border border-charcoal-800">
          <h4 className="font-poetry text-lg font-bold text-parchment-100">
            {poem.poet.name}
          </h4>
          <div className="flex items-center gap-2 mt-1 mb-2">
            <Badge variant="gold" size="sm">
              العصر ال{poem.poet.era}
            </Badge>
            {poem.poet.birthYear && (
              <span className="text-[11px] text-parchment-400">
                {poem.poet.birthYear}
              </span>
            )}
          </div>
          {poem.poet.bio && (
            <p className="text-xs text-parchment-300 leading-relaxed mt-2">
              {poem.poet.bio}
            </p>
          )}
        </div>
      </div>

      {/* Meter & Rhyme Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold uppercase tracking-wider">
          <Music className="w-4 h-4" />
          <span>العروض والوزن</span>
        </div>
        <div className="bg-charcoal-850 p-4 rounded-xl border border-charcoal-800 space-y-3">
          <div>
            <span className="text-[11px] text-parchment-400 block mb-1">بحر القصيدة</span>
            <span className="text-sm font-semibold text-parchment-100">
              بحر {poem.bahr}
            </span>
          </div>

          <div className="pt-2 border-t border-charcoal-800">
            <span className="text-[11px] text-parchment-400 block mb-1">القافية والرويّ</span>
            <span className="text-sm font-semibold text-parchment-100">
              {poem.rhyme}
            </span>
          </div>

          <div className="pt-2 border-t border-charcoal-800">
            <span className="text-[11px] text-parchment-400 block mb-1">عدد الأبيات</span>
            <span className="text-sm font-semibold text-parchment-100">
              {toArabicDigits(poem.versesCount)} أبيات
            </span>
          </div>
        </div>
      </div>

      {/* Recordings Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-gold-400 text-xs font-semibold uppercase tracking-wider">
          <Mic className="w-4 h-4" />
          <span>التسجيل والمحاذاة</span>
        </div>
        <div className="bg-charcoal-850 p-4 rounded-xl border border-charcoal-800 space-y-2">
          {poem.recordings.length > 0 ? (
            poem.recordings.map((rec) => (
              <div key={rec.id} className="text-xs space-y-1">
                <p className="font-semibold text-parchment-200">{rec.title}</p>
                <p className="text-parchment-400 text-[11px]">القارئ: {rec.reciter}</p>
                <Badge variant="success" size="sm" className="mt-1">
                  محاذاة كاملة بالذكاء الاصطناعي
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-xs text-parchment-400">
              <p>لا يوجد تسجيل صوتي مرتبط بعد.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {poem.tags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-parchment-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تصنيفات الموضوع</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {poem.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-1 rounded-md bg-charcoal-850 text-parchment-300 border border-charcoal-800"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
