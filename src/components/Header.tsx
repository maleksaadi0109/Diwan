import React from "react";
import { ActiveTab, Poem } from "@/types";
import { ChevronLeft } from "lucide-react";

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
    }
  };

  return (
    <header className="h-14 border-b border-charcoal-800 bg-charcoal-900/60 backdrop-blur px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {activeTab === "player" && activePoem && (
          <button
            onClick={onBackToLibrary}
            className="flex items-center gap-1 text-xs text-parchment-400 hover:text-gold-400 p-1.5 rounded-lg hover:bg-charcoal-800 transition-colors"
            title="العودة إلى المكتبة"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
            <span>المكتبة</span>
          </button>
        )}
        <h2 className="text-base font-semibold text-parchment-100 flex items-center gap-2">
          <span>{getTitle()}</span>
          {activeTab === "player" && activePoem && (
            <span className="text-xs font-normal text-gold-400/90 font-poetry">
              ({activePoem.poet.name})
            </span>
          )}
        </h2>
      </div>

      <div className="flex items-center gap-2 text-xs text-parchment-400">
        <span className="hidden sm:inline-block px-2 py-1 rounded bg-charcoal-800/80 border border-charcoal-700 font-mono text-[11px] ltr-num">
          Space: تشغيل/إيقاف
        </span>
      </div>
    </header>
  );
};
