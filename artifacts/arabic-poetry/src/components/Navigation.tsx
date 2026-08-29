import React from "react";
import { BookOpen, PlayCircle, Sliders, PlusCircle, Settings, Feather, Sparkles } from "lucide-react";
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
      className="w-72 bg-[#0E1015]/95 border-l border-white/[0.08] flex flex-col justify-between shrink-0 select-none backdrop-blur-2xl z-20 shadow-2xl relative"
    >
      {/* Subtle glowing ambient lighting */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div>
        {/* App Header / Brand */}
        <div className="p-7 border-b border-white/[0.07] flex flex-col items-center text-center gap-3 relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1C2029] to-[#12151C] border border-[#D4AF37]/30 flex items-center justify-center text-[#F3E19C] shadow-[0_0_20px_rgba(212,175,55,0.15)] relative group cursor-pointer">
            <Feather className="w-7 h-7 z-10 transition-transform duration-300 group-hover:scale-110" strokeWidth={1.75} />
            <div className="absolute inset-0 bg-[#D4AF37]/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="font-poetry text-4xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#FFF5DC] via-[#E8CD82] to-[#D4AF37] drop-shadow-[0_2px_10px_rgba(212,175,55,0.25)]">
              دِيـــوَان
            </h1>
            <p className="text-xs text-[#A0AAB7] font-sans tracking-widest mt-1 flex items-center justify-center gap-1">
              <span>شعر عربي ومحاذاة صوتية</span>
              <Sparkles className="w-3 h-3 text-[#D4AF37]/70" />
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 flex flex-col gap-1.5 mt-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => !item.disabled && onSelectTab(item.id)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 relative group text-right",
                  isActive
                    ? "text-[#F8F9FA] bg-gradient-to-l from-[#D4AF37]/15 to-white/[0.04] border border-[#D4AF37]/40 shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                    : "text-[#A0AAB7] hover:text-[#F8F9FA] hover:bg-white/[0.05] border border-transparent",
                  item.disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-[#A0AAB7]"
                )}
              >
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-gradient-to-b from-[#F3E19C] to-[#D4AF37] rounded-l-full shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
                )}
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    "p-1.5 rounded-lg transition-colors duration-300",
                    isActive ? "bg-[#D4AF37]/20 text-[#F3E19C]" : "text-[#6C7A8C] group-hover:text-[#E8CD82] group-hover:bg-white/[0.04]"
                  )}>
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <span className="text-[14px] font-sans tracking-wide font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.06] text-[#CED4DA] border border-white/10 font-sans tracking-wide">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer info & offline badge */}
      <div className="p-5">
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-3 h-3 rounded-full bg-emerald-500/30 animate-ping" />
              <span className="relative w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
            <span className="text-xs text-[#CED4DA] font-medium tracking-wide font-sans">محلي (Offline First)</span>
          </div>
          <span className="text-[10px] font-mono text-[#D4AF37]/80 font-bold bg-[#D4AF37]/10 px-2 py-0.5 rounded-md border border-[#D4AF37]/20 ltr-num">
            v1.0.0
          </span>
        </div>
      </div>
    </aside>
  );
};
