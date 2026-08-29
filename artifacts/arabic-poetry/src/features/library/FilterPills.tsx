import React from "react";
import { Era } from "@/types";
import { cn } from "@/lib/utils";

interface FilterPillsProps {
  selectedEra: Era | "الكل";
  onSelectEra: (era: Era | "الكل") => void;
}

const ERAS: (Era | "الكل")[] = [
  "الكل",
  "جاهلي",
  "إسلامي",
  "أموي",
  "عباسي",
  "أندلسي",
  "حديث",
];

export const FilterPills: React.FC<FilterPillsProps> = ({
  selectedEra,
  onSelectEra,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto select-none no-scrollbar px-1 py-1">
      {ERAS.map((era) => {
        const isSelected = selectedEra === era;
        return (
          <button
            key={era}
            onClick={() => onSelectEra(era)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-[13px] font-sans tracking-wide whitespace-nowrap transition-all duration-300 font-medium",
              isSelected
                ? "bg-gradient-to-r from-[#D4AF37] to-[#B89225] text-[#0A0C10] font-bold shadow-[0_0_16px_rgba(212,175,55,0.3)] border border-[#F3E19C]/40"
                : "bg-white/[0.04] text-[#A0AAB7] hover:bg-white/[0.08] hover:text-[#F8F9FA] border border-white/[0.06]"
            )}
          >
            {era === "الكل" ? "كل العصور" : `العصر ال${era}`}
          </button>
        );
      })}
    </div>
  );
};
