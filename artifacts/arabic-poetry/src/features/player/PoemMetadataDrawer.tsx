import React from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { User, Music, Mic, Sparkles, X } from "lucide-react";
import { toArabicDigits } from "@/lib/utils";

interface PoemMetadataDrawerProps {
  poem: Poem;
  isOpen: boolean;
  onToggle: () => void;
}

export const PoemMetadataDrawer: React.FC<PoemMetadataDrawerProps> = ({
  poem,
  isOpen,
  onToggle
}) => {
  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-sand-50 border-r border-sand-300 p-6 flex flex-col gap-8 overflow-y-auto shrink-0 select-none shadow-[inset_2px_0_12px_rgba(0,0,0,0.02)] relative">
      <button 
        onClick={onToggle}
        className="absolute top-4 left-4 p-1.5 rounded-full text-ink-400 hover:text-ink-800 hover:bg-sand-200 transition-colors"
        title="إغلاق البيانات"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Poet Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 text-crimson-800 text-xs font-bold tracking-widest font-sans uppercase">
          <User className="w-4 h-4" />
          <span>عن الشاعر</span>
        </div>
        <div className="bg-sand-100 p-5 rounded-2xl border border-sand-300 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-8 h-8 bg-sand-200 rounded-bl-full -z-10"></div>
          <h4 className="font-poetry text-2xl font-bold text-ink-950 leading-tight">
            {poem.poet.name}
          </h4>
          <div className="flex items-center gap-2 mt-2 mb-3">
            <Badge variant="gold" size="sm">
              العصر ال{poem.poet.era}
            </Badge>
            {poem.poet.birthYear && (
              <span className="text-[11px] text-ink-500 font-sans tracking-wide border-r border-sand-400 pr-2">
                {poem.poet.birthYear}
              </span>
            )}
          </div>
          {poem.poet.bio && (
            <p className="text-[13px] text-ink-700 leading-[1.8] mt-3 font-sans opacity-90 border-t border-sand-200/80 pt-3">
              {poem.poet.bio}
            </p>
          )}
        </div>
      </div>

      {/* Meter & Rhyme Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-crimson-800 text-xs font-bold tracking-widest font-sans uppercase">
          <Music className="w-4 h-4" />
          <span>العروض والوزن</span>
        </div>
        <div className="bg-sand-100 p-5 rounded-2xl border border-sand-300 shadow-sm space-y-4 font-sans tracking-wide">
          <div>
            <span className="text-[11px] text-ink-500 block mb-1">بحر القصيدة</span>
            <span className="text-[15px] font-bold text-ink-900 font-poetry">
              بحر {poem.bahr}
            </span>
          </div>

          <div className="pt-3 border-t border-sand-200/80">
            <span className="text-[11px] text-ink-500 block mb-1">القافية والرويّ</span>
            <span className="text-[15px] font-bold text-ink-900 font-poetry">
              {poem.rhyme}
            </span>
          </div>

          <div className="pt-3 border-t border-sand-200/80">
            <span className="text-[11px] text-ink-500 block mb-1">عدد الأبيات</span>
            <span className="text-sm font-semibold text-ink-900 flex items-baseline gap-1">
              <span className="text-lg">{toArabicDigits(poem.versesCount)}</span>
              <span className="text-xs">أبيات</span>
            </span>
          </div>
        </div>
      </div>

      {/* Recordings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-crimson-800 text-xs font-bold tracking-widest font-sans uppercase">
          <Mic className="w-4 h-4" />
          <span>التسجيل والمحاذاة</span>
        </div>
        <div className="bg-sand-100 p-5 rounded-2xl border border-sand-300 shadow-sm space-y-3 font-sans tracking-wide">
          {poem.recordings.length > 0 ? (
            poem.recordings.map((rec) => (
              <div key={rec.id} className="space-y-1.5">
                <p className="font-bold text-ink-900 text-sm">{rec.title}</p>
                <p className="text-ink-600 text-[11px] font-medium">بصوت: <span className="text-ink-800">{rec.reciter}</span></p>
                <Badge variant="success" size="sm" className="mt-2 text-[10px]">
                  محاذاة كاملة (Alignment)
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-xs text-ink-500 text-center py-2">
              <p>لا يوجد تسجيل صوتي مرتبط بعد.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {poem.tags.length > 0 && (
        <div className="space-y-3 pb-6">
          <div className="flex items-center gap-2 text-crimson-800 text-xs font-bold tracking-widest font-sans uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تصنيفات الموضوع</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {poem.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-sand-200 text-ink-800 border border-sand-300 font-medium font-sans tracking-wide hover:bg-sand-300 transition-colors cursor-default shadow-sm"
              >
                # {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
