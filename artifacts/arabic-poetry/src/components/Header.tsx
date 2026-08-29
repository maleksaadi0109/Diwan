import React from "react";
import { ActiveTab, Poem } from "@/types";
import { ChevronRight, Feather, Sparkles } from "lucide-react";

interface HeaderProps {
  activeTab: ActiveTab;
  activePoem: Poem | null;
  onBackToLibrary: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  activePoem,
  onBackToLibrary,
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case "library":
        return "مكتبة القصائد";
      case "player":
        return activePoem ? activePoem.title : "مشغّل القصيدة";
      case "import":
        return "استيراد قصيدة وتسجيل";
      case "settings":
        return "إعدادات التطبيق";
      case "editor":
        return "مراجعة محاذاة الأبيات";
      default:
        return "ديوان الشعر العربي";
    }
  };

  return (
    <header className="h-20 border-b border-white/[0.08] bg-[#0E1015]/90 backdrop-blur-xl px-8 flex items-center justify-between shrink-0 z-10 relative select-none">
      <div className="flex items-center gap-4 min-w-0">
        {activeTab === "player" && activePoem && (
          <>
            <button
              onClick={onBackToLibrary}
              className="flex items-center gap-2 text-xs font-bold text-[#A0AAB7] hover:text-[#F8F9FA] px-3.5 py-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-xl transition-all shadow-sm shrink-0 whitespace-nowrap font-sans cursor-pointer"
              title="العودة إلى المكتبة"
            >
              <ChevronRight className="w-4 h-4 text-[#D4AF37]" strokeWidth={2.5} />
              <span>المكتبة</span>
            </button>
            <div className="w-px h-6 bg-white/[0.08]" />
          </>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-2xl md:text-3xl font-bold text-[#F8F9FA] font-poetry tracking-wide flex items-center gap-2.5 truncate">
            <span>{getTitle()}</span>
            {activeTab === "library" && <Sparkles className="w-4 h-4 text-[#D4AF37]" />}
          </h2>
          {activeTab === "player" && activePoem && (
            <span className="text-xs font-bold text-[#D4AF37] border border-[#D4AF37]/40 px-3 py-1 bg-[#D4AF37]/10 rounded-xl flex items-center gap-1.5 shadow-[0_0_10px_rgba(212,175,55,0.15)] shrink-0 font-sans">
              <Feather className="w-3.5 h-3.5" />
              <span>{activePoem.poet.name}</span>
            </span>
          )}
        </div>
      </div>

      {activeTab === "player" && activePoem && (
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-1.5 bg-black/40 border border-white/10 text-xs ltr-num text-[#A0AAB7] flex items-center gap-2.5 shadow-inner rounded-xl">
            <kbd className="font-mono font-bold text-[10px] text-[#F3E19C] border border-white/20 bg-white/[0.06] px-2 py-0.5 rounded-lg shadow-sm">
              SPACE
            </kbd>
            <span className="font-sans font-medium text-[11px]">تشغيل / إيقاف</span>
          </div>
        </div>
      )}
    </header>
  );
};
