import React from "react";
import { BookOpen, PlayCircle, PlusCircle, Settings, Feather, ListMusic } from "lucide-react";
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
      mobileLabel: "المكتبة",
      icon: BookOpen,
      badge: `${toArabicDigits(poemsCount)} قصائد`,
    },
    {
      id: "player" as ActiveTab,
      label: "المشغّل والمزامنة",
      mobileLabel: "المشغّل",
      icon: PlayCircle,
      disabled: !hasActivePoem,
    },
    {
      id: "import" as ActiveTab,
      label: "استيراد قصيدة",
      mobileLabel: "استيراد",
      icon: PlusCircle,
    },
    {
      id: "playlists" as ActiveTab,
      label: "قوائم التشغيل",
      mobileLabel: "القوائم",
      icon: ListMusic,
    },
    {
      id: "settings" as ActiveTab,
      label: "الإعدادات",
      mobileLabel: "الإعدادات",
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        aria-label="القائمة الرئيسية"
        className="hidden md:flex w-72 bg-charcoal-900 border-l border-white/5 flex-col justify-between shrink-0 select-none z-20 relative"
      >
        <div>
          {/* App Header / Brand */}
          <div className="p-8 flex flex-col items-center text-center gap-4 relative">
            <div>
              <h1 className="font-heading text-4xl text-accent-700 tracking-wide mt-2">
                دِيـــوَان
              </h1>
              <p className="text-[12px] text-ink-500 font-ui tracking-widest mt-2 uppercase">
                شعر عربي ومحاذاة صوتية
              </p>
            </div>
            <div className="w-12 h-px bg-accent-700/30 mt-2" />
          </div>

          {/* Navigation Items */}
          <nav className="px-4 flex flex-col gap-2 mt-4" aria-label="أقسام التطبيق">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && onSelectTab(item.id)}
                  disabled={item.disabled}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-[15px] transition-all relative group text-right cursor-pointer",
                    isActive
                      ? "text-accent-700 bg-accent-700/10 font-bold"
                      : "text-ink-500 hover:text-ink-900 hover:bg-white/5 font-medium",
                    item.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-accent-700" : "text-ink-600 group-hover:text-ink-800")} strokeWidth={isActive ? 2 : 1.5} />
                    <span className="font-ui">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[11px] px-2 py-0.5 bg-charcoal-800 text-ink-500 rounded-full font-ui font-medium border border-white/5">
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
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-charcoal-800 border border-white/5 relative">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-700 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-700"></span>
              </span>
              <span className="text-xs text-ink-500 font-medium font-ui">محلي (Offline)</span>
            </div>
            <span className="text-[10px] font-mono text-ink-600">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation -- a fixed 5-column grid so all items
          always fit down to a 320px viewport without min-widths that could
          overflow, and a fixed content height (--mobile-nav-h) so the main
          content and mini-player offsets that depend on it never drift out
          of sync. Labels are shortened here (full names remain on desktop
          and as the accessible name) so a single line never wraps and grows
          the bar taller than that reserved height. */}
      <nav
        className="md:hidden grid grid-cols-5 bg-charcoal-900 border-t border-white/5 z-40 fixed bottom-0 left-0 right-0"
        style={{ height: "calc(var(--mobile-nav-h) + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="أقسام التطبيق"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && onSelectTab(item.id)}
              disabled={item.disabled}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-1 min-w-0 transition-all",
                isActive ? "text-accent-700" : "text-ink-500",
                item.disabled && "opacity-40"
              )}
            >
              <Icon className="w-5.5 h-5.5 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-ui font-medium leading-none truncate max-w-full">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
