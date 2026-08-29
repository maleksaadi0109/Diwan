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
    <div className="flex items-center gap-2 overflow-x-auto select-none no-scrollbar px-1 py-1">
      {ERAS.map((era) => {
        const isSelected = selectedEra === era;
        return (
          <button
            key={era}
            onClick={() => onSelectEra(era)}
            className={cn(
              "px-4 py-1.5 rounded-none text-[14px] font-ui whitespace-nowrap transition-colors",
              isSelected
                ? "bg-accent-700 text-paper-100 font-bold border border-accent-700"
                : "bg-transparent text-ink-700 hover:bg-paper-200 border border-transparent font-medium"
            )}
          >
            {era === "الكل" ? "كل العصور" : `العصر ال${era}`}
          </button>
        );
      })}
    </div>
  );
};
