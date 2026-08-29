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
              "px-4 py-2 rounded-lg text-[13px] font-sans tracking-wide whitespace-nowrap transition-all duration-300",
              isSelected
                ? "bg-ink-900 text-sand-50 shadow-md border border-ink-950"
                : "bg-sand-100 text-ink-600 hover:bg-sand-200/80 hover:text-ink-900 border border-sand-300 shadow-sm"
            )}
          >
            {era === "الكل" ? "كل العصور" : `العصر ال${era}`}
          </button>
        );
      })}
    </div>
  );
};
