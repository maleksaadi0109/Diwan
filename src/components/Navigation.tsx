import React from "react";
import { BookOpen, PlayCircle, Sliders, PlusCircle, Settings, Feather } from "lucide-react";
import { ActiveTab } from "@/types";
import { cn } from "@/lib/utils";

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  hasActivePoem: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  hasActivePoem,
}) => {
  const navItems = [
    {
      id: "library" as ActiveTab,
      label: "المكتبة",
      icon: BookOpen,
      badge: "٣ قصائد",
    },
    {
      id: "player" as ActiveTab,
      label: "المشغّل والمزامنة",
      icon: PlayCircle,
      disabled: !hasActivePoem,
    },
    {
      id: "editor" as ActiveTab,
      label: "محرر الحدود الزمنية",
      icon: Sliders,
      disabled: !hasActivePoem,
    },
    {
      id: "import" as ActiveTab,
      label: "استيراد قصيدة",
      icon: PlusCircle,
    },
    {
      id: "settings" as ActiveTab,
      label: "الإعدادات",
      icon: Settings,
    },
  ];

  return (
    <aside
      aria-label="القائمة الرئيسية"
      className="w-64 bg-charcoal-900 border-l border-charcoal-800 flex flex-col justify-between shrink-0 select-none"
    >
      {/* App Header / Brand */}
      <div>
        <div className="p-6 border-b border-charcoal-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/40 flex items-center justify-center text-gold-400 shadow-inner">
            <Feather className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-poetry text-2xl font-bold text-parchment-50 tracking-wide">
              دِيـــوَان
            </h1>
            <p className="text-xs text-parchment-400 font-sans">
              شعر عربي ومحاذاة صوتية
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => !item.disabled && onSelectTab(item.id)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-gold-500/15 text-gold-300 border border-gold-500/30 shadow-sm"
                    : "text-parchment-300 hover:text-parchment-100 hover:bg-charcoal-800/60 border border-transparent",
                  item.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-parchment-400"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-5 h-5", isActive ? "text-gold-400" : "text-parchment-400")} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-charcoal-800 text-parchment-400 border border-charcoal-700">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer info & offline badge */}
      <div className="p-4 border-t border-charcoal-800/80 text-xs text-parchment-400">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-charcoal-850 border border-charcoal-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>نظام محلي (دون إنترنت)</span>
          </div>
          <span className="text-[10px] font-mono text-parchment-400 ltr-num">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
};
