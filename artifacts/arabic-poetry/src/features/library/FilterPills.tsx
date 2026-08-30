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
    <div
      className="flex items-center gap-1.5 overflow-x-auto select-none no-scrollbar py-1 w-full md:w-auto"
      role="group"
      aria-label="تصفية حسب العصر"
    >
      {ERAS.map((era) => {
        const isSelected = selectedEra === era;
        return (
          <button
            key={era}
            onClick={() => onSelectEra(era)}
            aria-pressed={isSelected}
            className={cn(
              "px-4 py-2 rounded-xl text-[13px] font-sans whitespace-nowrap transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700",
              isSelected
                ? "bg-white/10 text-parchment-100 font-bold border-white/20"
                : "bg-transparent text-ink-500 hover:bg-white/5 hover:text-ink-700 border-transparent font-medium"
            )}
          >
            {era === "الكل" ? "كل العصور" : `العصر ال${era}`}
          </button>
        );
      })}
    </div>
  );
};
