import React from "react";
import { ActiveTab, Poem } from "@/types";
import { ChevronRight } from "lucide-react";

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
    <header className="h-20 border-b border-sand-300 bg-sand-50/80 backdrop-blur-md px-8 flex items-center justify-between shrink-0 z-10 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.02)] relative">
      <div className="flex items-center gap-4">
        {activeTab === "player" && activePoem && (
          <>
            <button
              onClick={onBackToLibrary}
              className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-crimson-800 pr-1 pl-3 py-2 rounded-lg hover:bg-sand-200/80 transition-all duration-300"
              title="العودة إلى المكتبة"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
              <span>المكتبة</span>
            </button>
            <div className="w-[1px] h-6 bg-sand-300"></div>
          </>
        )}
        <h2 className="text-xl font-bold text-ink-900 flex items-baseline gap-3">
          <span className="font-poetry text-2xl tracking-wide">{getTitle()}</span>
          {activeTab === "player" && activePoem && (
            <span className="text-sm font-normal text-crimson-800 font-sans opacity-80 border border-crimson-800/20 px-2 py-0.5 rounded-full bg-crimson-800/5">
              {activePoem.poet.name}
            </span>
          )}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <span className="px-3 py-1.5 rounded-md bg-sand-200/60 border border-sand-300/80 font-mono text-[11px] ltr-num text-ink-600 flex items-center gap-2 shadow-sm">
          <span className="font-sans font-medium text-[10px] text-ink-500 uppercase tracking-widest bg-sand-100 px-1 rounded border border-sand-300">SPACE</span>
          تشغيل / إيقاف
        </span>
      </div>
    </header>
  );
};
