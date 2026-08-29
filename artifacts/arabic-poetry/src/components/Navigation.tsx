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
      className="w-72 bg-sand-50 border-l border-sand-300 flex flex-col justify-between shrink-0 select-none shadow-[2px_0_12px_rgba(0,0,0,0.02)] z-10"
    >
      <div>
        {/* App Header / Brand */}
        <div className="p-8 border-b border-sand-300/80 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-sand-100 border border-sand-400 flex items-center justify-center text-crimson-800 shadow-inner relative overflow-hidden">
            <Feather className="w-6 h-6 z-10" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-poetry text-4xl font-bold text-ink-950 tracking-tight leading-tight">
              دِيـــوَان
            </h1>
            <p className="text-[13px] text-ink-500 font-sans tracking-wide mt-1">
              شعر عربي ومحاذاة صوتية
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 flex flex-col gap-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => !item.disabled && onSelectTab(item.id)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 rounded-lg text-sm font-medium transition-all duration-300 relative group",
                  isActive
                    ? "text-crimson-900 bg-sand-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
                    : "text-ink-600 hover:text-ink-900 hover:bg-sand-100",
                  item.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-ink-600"
                )}
              >
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-crimson-800 rounded-l-md" />
                )}
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-5 h-5 transition-colors duration-300", isActive ? "text-crimson-800" : "text-sand-500 group-hover:text-ink-700")} strokeWidth={1.5} />
                  <span className="text-[15px] font-sans tracking-wide">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sand-200 text-ink-600 border border-sand-300 font-sans tracking-wide">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer info & offline badge */}
      <div className="p-6">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-sand-100 border border-sand-300/80">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-600/40 animate-ping"></span>
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            </div>
            <span className="text-xs text-ink-600 tracking-wide font-sans">نظام محلي</span>
          </div>
          <span className="text-[10px] font-mono text-sand-500 font-bold ltr-num">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
