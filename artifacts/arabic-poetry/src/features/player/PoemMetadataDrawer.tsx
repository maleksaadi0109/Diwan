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
    <aside className="w-80 bg-[#0E1015]/95 border-r border-white/[0.08] p-6 flex flex-col gap-6 overflow-y-auto shrink-0 select-none backdrop-blur-2xl relative shadow-2xl">
      <button 
        onClick={onToggle}
        className="absolute top-4 left-4 p-2 rounded-xl text-[#A0AAB7] hover:text-[#F8F9FA] hover:bg-white/[0.08] transition-colors"
        title="إغلاق البيانات"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Poet Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold tracking-widest font-sans uppercase">
          <Feather className="w-3.5 h-3.5" />
          <span>عن الشاعر</span>
        </div>
        <div className="bg-[#14171E] p-5 rounded-2xl border border-white/[0.08] shadow-inner relative overflow-hidden">
          <h4 className="font-poetry text-2xl font-bold text-[#F8F9FA] leading-tight">
            {poem.poet.name}
          </h4>
          <div className="flex items-center gap-2 mt-2 mb-3">
            <Badge variant="gold" size="sm">
              العصر ال{poem.poet.era}
            </Badge>
            {poem.poet.birthYear && (
              <span className="text-[11px] text-[#A0AAB7] font-sans tracking-wide border-r border-white/10 pr-2">
                {poem.poet.birthYear}
              </span>
            )}
          </div>
          {poem.poet.bio && (
            <p className="text-[13px] text-[#CED4DA] leading-[1.9] mt-3 font-sans border-t border-white/[0.06] pt-3">
              {poem.poet.bio}
            </p>
          )}
        </div>
      </div>

      {/* Meter & Rhyme Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold tracking-widest font-sans uppercase">
          <Music className="w-3.5 h-3.5" />
          <span>العروض والوزن</span>
        </div>
        <div className="bg-[#14171E] p-5 rounded-2xl border border-white/[0.08] shadow-inner space-y-4 font-sans tracking-wide">
          <div>
            <span className="text-[11px] text-[#6C7A8C] block mb-1">بحر القصيدة</span>
            <span className="text-[16px] font-bold text-[#F3E19C] font-poetry">
              بحر {poem.bahr}
            </span>
          </div>

          <div className="pt-3 border-t border-white/[0.06]">
            <span className="text-[11px] text-[#6C7A8C] block mb-1">القافية والرويّ</span>
            <span className="text-[16px] font-bold text-[#F8F9FA] font-poetry">
              {poem.rhyme}
            </span>
          </div>

          <div className="pt-3 border-t border-white/[0.06]">
            <span className="text-[11px] text-[#6C7A8C] block mb-1">عدد الأبيات</span>
            <span className="text-sm font-semibold text-[#F8F9FA] flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-[#F3E19C]">{toArabicDigits(poem.versesCount)}</span>
              <span className="text-xs text-[#A0AAB7]">أبيات</span>
            </span>
          </div>
        </div>
      </div>

      {/* Recordings Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold tracking-widest font-sans uppercase">
          <Mic className="w-3.5 h-3.5" />
          <span>التسجيل والمحاذاة</span>
        </div>
        <div className="bg-[#14171E] p-5 rounded-2xl border border-white/[0.08] shadow-inner space-y-3 font-sans tracking-wide">
          {poem.recordings.length > 0 ? (
            poem.recordings.map((rec) => (
              <div key={rec.id} className="space-y-1.5">
                <p className="font-bold text-[#F8F9FA] text-sm">{rec.title}</p>
                <p className="text-[#A0AAB7] text-[11px] font-medium">بصوت: <span className="text-[#F3E19C]">{rec.reciter}</span></p>
                <div className="mt-2">
                  <Badge variant="success" size="sm" className="text-[10px]">
                    محاذاة كاملة (Alignment)
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-[#6C7A8C] text-center py-2">
              <p>لا يوجد تسجيل صوتي مرتبط بعد.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {poem.tags.length > 0 && (
        <div className="space-y-3 pb-4">
          <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold tracking-widest font-sans uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تصنيفات الموضوع</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {poem.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-3 py-1 rounded-lg bg-white/[0.04] text-[#CED4DA] border border-white/[0.08] font-medium font-sans tracking-wide hover:bg-white/[0.08] transition-colors cursor-default"
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
