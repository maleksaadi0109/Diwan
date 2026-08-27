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
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
      {ERAS.map((era) => {
        const isSelected = selectedEra === era;
        return (
          <button
            key={era}
            onClick={() => onSelectEra(era)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150",
              isSelected
                ? "bg-gold-500 text-charcoal-950 font-semibold shadow-sm"
                : "bg-charcoal-850 text-parchment-300 hover:bg-charcoal-800 border border-charcoal-700/60"
            )}
          >
            {era === "الكل" ? "كل العصور" : `العصر ال${era}`}
          </button>
        );
      })}
    </div>
  );
};
