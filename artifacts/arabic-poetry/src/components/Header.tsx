import React from "react";
import { ActiveTab, Poem } from "@/types";
import { ChevronRight, Sparkles } from "lucide-react";

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
    <header className="h-20 border-b border-white/[0.08] bg-[#0E1015]/80 backdrop-blur-2xl px-8 flex items-center justify-between shrink-0 z-10 relative">
      <div className="flex items-center gap-4">
        {activeTab === "player" && activePoem && (
          <>
            <button
              onClick={onBackToLibrary}
              className="flex items-center gap-2 text-[13px] font-medium text-[#A0AAB7] hover:text-[#F8F9FA] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all duration-300 shadow-sm"
              title="العودة إلى المكتبة"
            >
              <ChevronRight className="w-4 h-4 text-[#D4AF37]" strokeWidth={2.5} />
              <span>المكتبة</span>
            </button>
            <div className="w-[1px] h-6 bg-white/[0.1]"></div>
          </>
        )}
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#F8F9FA] flex items-baseline gap-3">
            <span className="font-poetry text-2xl md:text-3xl tracking-wide font-bold drop-shadow-sm text-transparent bg-clip-text bg-gradient-to-r from-white via-[#F5F2EA] to-[#D4AF37]">
              {getTitle()}
            </span>
          </h2>
          {activeTab === "player" && activePoem && (
            <span className="text-xs font-medium text-[#F3E19C] border border-[#D4AF37]/30 px-3 py-1 rounded-full bg-[#D4AF37]/10 flex items-center gap-1.5 shadow-[0_0_12px_rgba(212,175,55,0.15)]">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              <span>{activePoem.poet.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] font-mono text-[11px] ltr-num text-[#CED4DA] flex items-center gap-2.5 shadow-sm backdrop-blur-md">
          <kbd className="font-sans font-bold text-[10px] text-[#F3E19C] bg-[#D4AF37]/15 px-2 py-0.5 rounded-md border border-[#D4AF37]/30 shadow-inner">
            SPACE
          </kbd>
          <span className="font-sans text-xs text-[#A0AAB7]">تشغيل / إيقاف</span>
        </div>
      </div>
    </header>
  );
};
