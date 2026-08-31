import React from "react";
import { ActiveTab, Poem } from "@/types";
import { ChevronRight, Feather, Sparkles, Undo2, Redo2 } from "lucide-react";

interface HeaderProps {
  activeTab: ActiveTab;
  activePoem: Poem | null;
  onBackToLibrary: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoLabel?: string | null;
  redoLabel?: string | null;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  activePoem,
  onBackToLibrary,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  onUndo,
  onRedo,
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case "library":
        return "مكتبة القصائد";
      case "player":
        return activePoem ? activePoem.title : "مشغّل القصيدة";
      case "import":
        return "استيراد قصيدة وتسجيل";
      case "playlists":
        return "قوائم التشغيل";
      case "settings":
        return "إعدادات التطبيق";
      default:
        return "ديوان الشعر العربي";
    }
  };

  return (
    <header className="h-16 md:h-20 border-b border-white/5 bg-charcoal-900/80 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between shrink-0 z-10 relative select-none">
      <div className="flex items-center gap-4 min-w-0">
        {activeTab === "player" && activePoem && (
          <>
            <button
              onClick={onBackToLibrary}
              className="flex items-center gap-1.5 text-xs font-bold text-ink-500 hover:text-ink-900 px-3 py-1.5 md:px-3.5 md:py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all shrink-0 whitespace-nowrap font-sans cursor-pointer focus-visible:ring-2 focus-visible:ring-accent-700"
              title="العودة إلى المكتبة"
              aria-label="العودة إلى المكتبة"
            >
              <ChevronRight className="w-4 h-4 text-accent-700" strokeWidth={2.5} />
              <span className="hidden md:inline">المكتبة</span>
            </button>
            <div className="w-px h-6 bg-white/10" />
          </>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-parchment-100 font-poetry tracking-wide flex items-center gap-2.5 truncate">
            <span className="truncate">{getTitle()}</span>
            {activeTab === "library" && <Sparkles className="w-4 h-4 text-accent-700 shrink-0" />}
          </h2>
          {activeTab === "player" && activePoem && (
            <span className="hidden sm:flex text-[11px] md:text-xs font-bold text-accent-700 border border-accent-700/20 px-3 py-1 bg-accent-700/10 rounded-full items-center gap-1.5 shrink-0 font-sans">
              <Feather className="w-3.5 h-3.5" />
              <span>{activePoem.poet.name}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {(canUndo || canRedo) && (
          <div className="flex items-center gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 md:p-2 rounded-lg text-ink-400 hover:text-parchment-100 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-400 transition-colors cursor-pointer disabled:cursor-default"
              title={canUndo ? `تراجع: ${undoLabel} (Ctrl+Z)` : "لا يوجد ما يمكن التراجع عنه"}
              aria-label="تراجع"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 md:p-2 rounded-lg text-ink-400 hover:text-parchment-100 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-400 transition-colors cursor-pointer disabled:cursor-default"
              title={canRedo ? `إعادة: ${redoLabel} (Ctrl+Shift+Z)` : "لا يوجد ما يمكن إعادته"}
              aria-label="إعادة"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {activeTab === "player" && activePoem && (
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-1.5 bg-black/20 text-xs ltr-num text-ink-500 flex items-center gap-2.5 rounded-xl border border-white/5">
              <kbd className="font-mono font-bold text-[10px] text-accent-500 border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg shadow-sm">
                SPACE
              </kbd>
              <span className="font-sans font-medium text-[11px]">تشغيل / إيقاف</span>
            </div>
            <div
              className="px-3.5 py-1.5 bg-black/20 text-xs ltr-num text-ink-500 flex items-center gap-2.5 rounded-xl border border-white/5"
              title="عرض جميع الاختصارات"
            >
              <kbd className="font-mono font-bold text-[10px] text-accent-500 border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg shadow-sm">
                ?
              </kbd>
              <span className="font-sans font-medium text-[11px]">الاختصارات</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
