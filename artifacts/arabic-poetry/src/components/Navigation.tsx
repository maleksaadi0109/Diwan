import React from "react";
import { BookOpen, PlayCircle, PlusCircle, Settings, Feather } from "lucide-react";
import { ActiveTab } from "@/types";
import { cn, toArabicDigits } from "@/lib/utils";

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  hasActivePoem: boolean;
  poemsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  hasActivePoem,
  poemsCount = 0,
}) => {
  const navItems = [
    {
      id: "library" as ActiveTab,
      label: "المكتبة",
      icon: BookOpen,
      badge: `${toArabicDigits(poemsCount)} قصائد`,
    },
    {
      id: "player" as ActiveTab,
      label: "المشغّل والمزامنة",
      icon: PlayCircle,
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
      className="w-72 bg-paper-100 border-l border-paper-400 flex flex-col justify-between shrink-0 select-none z-20 relative"
    >
      <div>
        {/* App Header / Brand */}
        <div className="p-7 border-b border-paper-400 flex flex-col items-center text-center gap-4 relative">
          <div>
            <h1 className="font-heading text-5xl text-accent-700 tracking-wide mt-2">
              دِيـــوَان
            </h1>
            <p className="text-[13px] text-ink-600 font-ui tracking-widest mt-2">
              شعر عربي ومحاذاة صوتية
            </p>
          </div>
          <div className="w-full h-px bg-paper-400 mt-2" />
          <div className="w-2/3 h-px bg-paper-400" />
        </div>

        {/* Navigation Items */}
        <nav className="p-4 flex flex-col gap-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => !item.disabled && onSelectTab(item.id)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-none text-[15px] transition-colors relative group text-right border border-transparent",
                  isActive
                    ? "text-accent-700 bg-paper-200 border-paper-400 font-bold"
                    : "text-ink-700 hover:text-ink-900 hover:bg-paper-200/50 font-medium",
                  item.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:border-transparent"
                )}
              >
                {isActive && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-700" />
                )}
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "transition-colors duration-300",
                    isActive ? "text-accent-700" : "text-ink-500 group-hover:text-ink-700"
                  )}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="font-ui">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[11px] px-2 py-0.5 bg-paper-300 text-ink-600 border border-paper-400 font-ui font-medium">
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
        <div className="flex items-center justify-between px-4 py-3 border border-paper-400 bg-paper-200 shadow-sm relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-paper-100" />
          <div className="flex items-center gap-2.5">
            <span className="relative w-2.5 h-2.5 bg-accent-700 rotate-45" />
            <span className="text-xs text-ink-700 font-medium font-ui">محلي (Offline)</span>
          </div>
          <span className="text-[11px] font-mono text-ink-500 border-b border-ink-300">
            v1.0.0
          </span>
        </div>
      </div>
    </aside>
  );
};
