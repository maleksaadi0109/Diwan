import React from "react";
import { ActiveTab, Poem } from "@/types";
import { ChevronRight, Feather } from "lucide-react";

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
    <header className="h-20 border-b-2 border-paper-400 bg-paper-100 px-8 flex items-center justify-between shrink-0 z-10 relative">
      <div className="absolute bottom-1 left-0 right-0 h-px bg-paper-300" />
      <div className="flex items-center gap-4 min-w-0">
        {activeTab === "player" && activePoem && (
          <>
            <button
              onClick={onBackToLibrary}
              className="flex items-center gap-2 text-[14px] font-medium text-ink-600 hover:text-ink-900 px-3 py-1.5 bg-paper-200 hover:bg-paper-300 border border-paper-400 transition-colors shadow-sm shrink-0 whitespace-nowrap"
              title="العودة إلى المكتبة"
            >
              <ChevronRight className="w-4 h-4 text-accent-700" strokeWidth={2} />
              <span>المكتبة</span>
            </button>
            <div className="w-px h-6 bg-paper-400"></div>
          </>
        )}
        <div className="flex items-center gap-4 min-w-0">
          <h2 className="text-xl font-bold text-ink-900 flex items-baseline min-w-0">
            <span className="font-heading text-3xl tracking-wide text-ink-900">
              {getTitle()}
            </span>
          </h2>
          {activeTab === "player" && activePoem && (
            <span className="text-xs font-bold text-accent-700 border border-accent-700 px-3 py-1 bg-paper-200 flex items-center gap-1.5 shadow-sm rounded-none">
              <Feather className="w-3.5 h-3.5" />
              <span>{activePoem.poet.name}</span>
            </span>
          )}
        </div>
      </div>

      {activeTab === "player" && activePoem && (
      <div className="flex items-center gap-3 shrink-0">
        <div className="px-3.5 py-1.5 bg-paper-200 border border-paper-400 text-[12px] ltr-num text-ink-700 flex items-center gap-3 shadow-sm rounded-none">
          <kbd className="font-ui font-bold text-[11px] text-accent-700 border border-accent-700/40 bg-paper-100 px-2 rounded-none">
            SPACE
          </kbd>
          <span className="font-ui font-medium">تشغيل / إيقاف</span>
        </div>
      </div>
      )}
    </header>
  );
};
