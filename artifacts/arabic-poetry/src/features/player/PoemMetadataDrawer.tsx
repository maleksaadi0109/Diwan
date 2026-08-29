import React from "react";
import { Poem } from "@/types";
import { Badge } from "@/components/Badge";
import { User, Music, Mic, Sparkles, X, Feather } from "lucide-react";
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
    <aside className="w-80 bg-paper-100 border-r border-paper-400 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 select-none relative shadow-sm">
      <button 
        onClick={onToggle}
        className="absolute top-4 left-4 p-2 rounded-none text-ink-600 hover:text-ink-900 hover:bg-paper-200 transition-colors"
        title="إغلاق البيانات"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>

      {/* Poet Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
          <Feather className="w-4 h-4" />
          <span>عن الشاعر</span>
        </div>
        <div className="bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm relative overflow-hidden">
          <h4 className="font-heading text-3xl font-bold text-ink-900 leading-tight">
            {poem.poet.name}
          </h4>
          <div className="flex items-center gap-2 mt-3 mb-3">
            <Badge variant="charcoal" size="sm">
              العصر ال{poem.poet.era}
            </Badge>
            {poem.poet.birthYear && (
              <span className="text-[13px] text-ink-700 font-ui font-bold tracking-wide border-r border-paper-400 pr-2">
                {poem.poet.birthYear}
              </span>
            )}
          </div>
          {poem.poet.bio && (
            <p className="text-[14px] text-ink-800 leading-[2] mt-3 font-ui border-t border-paper-400 pt-3">
              {poem.poet.bio}
            </p>
          )}
        </div>
      </div>

      {/* Meter & Rhyme Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
          <Music className="w-4 h-4" />
          <span>العروض والوزن</span>
        </div>
        <div className="bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm space-y-4 font-ui">
          <div>
            <span className="text-[12px] font-bold text-ink-600 block mb-1">بحر القصيدة</span>
            <span className="text-[18px] font-bold text-ink-900 font-heading">
              بحر {poem.bahr}
            </span>
          </div>

          <div className="pt-3 border-t border-paper-400">
            <span className="text-[12px] font-bold text-ink-600 block mb-1">القافية والرويّ</span>
            <span className="text-[18px] font-bold text-ink-900 font-heading">
              {poem.rhyme}
            </span>
          </div>

          <div className="pt-3 border-t border-paper-400">
            <span className="text-[12px] font-bold text-ink-600 block mb-1">عدد الأبيات</span>
            <span className="text-sm font-bold text-ink-900 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">{toArabicDigits(poem.versesCount)}</span>
              <span className="text-sm text-ink-700">أبيات</span>
            </span>
          </div>
        </div>
      </div>

      {/* Recordings Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
          <Mic className="w-4 h-4" />
          <span>التسجيل والمحاذاة</span>
        </div>
        <div className="bg-paper-200 p-5 rounded-none border border-paper-400 shadow-sm space-y-3 font-ui">
          {poem.recordings.length > 0 ? (
            poem.recordings.map((rec) => (
              <div key={rec.id} className="space-y-1.5 border-b border-paper-400 last:border-0 pb-3 last:pb-0">
                <p className="font-bold text-ink-900 text-[15px]">{rec.title}</p>
                <p className="text-ink-600 text-[13px] font-bold">بصوت: <span className="text-ink-900">{rec.reciter}</span></p>
                <div className="mt-2">
                  <Badge variant="success" size="sm" className="text-[11px]">
                    محاذاة كاملة
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-[13px] font-bold text-ink-500 text-center py-2 border border-dashed border-paper-400 p-3">
              <p>لا يوجد تسجيل صوتي مرتبط بعد.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {poem.tags.length > 0 && (
        <div className="space-y-3 pb-4">
          <div className="flex items-center gap-2 text-accent-700 text-sm font-bold font-ui">
            <Sparkles className="w-4 h-4" />
            <span>تصنيفات الموضوع</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {poem.tags.map((tag) => (
              <span
                key={tag}
                className="text-[12px] px-3 py-1 rounded-none bg-transparent text-ink-800 border border-paper-400 font-bold font-ui hover:bg-paper-200 transition-colors cursor-default"
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
