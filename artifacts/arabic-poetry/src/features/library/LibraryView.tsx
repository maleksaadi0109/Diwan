import React, { useState, useMemo } from "react";
import { Poem, Era } from "@/types";
import { SearchBar } from "./SearchBar";
import { FilterPills } from "./FilterPills";
import { PoemCard } from "./PoemCard";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";
import { BookOpen } from "lucide-react";

interface LibraryViewProps {
  poems: Poem[];
  onOpenPoem: (poem: Poem) => void;
  onNavigateToImport: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  poems,
  onOpenPoem,
  onNavigateToImport,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEra, setSelectedEra] = useState<Era | "الكل">("الكل");

  const filteredPoems = useMemo(() => {
    const normalizedQuery = normalizeArabic(searchQuery);

    return poems.filter((poem) => {
      // Era filter
      if (selectedEra !== "الكل" && poem.era !== selectedEra) {
        return false;
      }

      // Search filter
      if (!normalizedQuery) return true;

      const titleMatch = normalizeArabic(poem.title).includes(normalizedQuery);
      const poetMatch = normalizeArabic(poem.poet.name).includes(normalizedQuery);
      const tagMatch = poem.tags.some((tag) =>
        normalizeArabic(tag).includes(normalizedQuery)
      );
      const verseMatch = poem.verses.some((verse) =>
        verse.normalizedText.includes(normalizedQuery)
      );

      return titleMatch || poetMatch || tagMatch || verseMatch;
    });
  }, [poems, searchQuery, selectedEra]);

  return (
    <div className="h-full flex flex-col overflow-y-auto px-8 py-6 max-w-7xl mx-auto w-full">
      {/* Top Section */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-parchment-100 font-poetry">
              ديوان الشعر العربي
            </h2>
            <p className="text-sm text-parchment-400 mt-0.5">
              تصفح القصائد المحفوظة والمحاذاة صوتياً
            </p>
          </div>
          <button
            onClick={onNavigateToImport}
            className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-charcoal-950 font-semibold text-sm transition-all shadow-sm flex items-center gap-2"
          >
            <span>+ استيراد قصيدة جديدة</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <FilterPills selectedEra={selectedEra} onSelectEra={setSelectedEra} />
        </div>
      </div>

      {/* Counter summary */}
      <div className="flex items-center justify-between text-xs text-parchment-400 mb-4 pb-2 border-b border-charcoal-850">
        <span>
          عرض {toArabicDigits(filteredPoems.length)} من إجمالي {toArabicDigits(poems.length)} قصائد
        </span>
      </div>

      {/* Grid of Poem Cards */}
      {filteredPoems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-8">
          {filteredPoems.map((poem) => (
            <PoemCard key={poem.id} poem={poem} onOpenPoem={onOpenPoem} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-charcoal-900/40 border border-charcoal-800/80 rounded-2xl">
          <BookOpen className="w-12 h-12 text-charcoal-700 mb-3" />
          <h3 className="text-base font-semibold text-parchment-200 mb-1">
            لا توجد قصائد مطابقة لبحثك
          </h3>
          <p className="text-xs text-parchment-400 max-w-sm mb-4">
            جرب تعديل كلمات البحث أو تصفية العصور، أو أضف قصيدة جديدة إلى ديوانك.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedEra("الكل");
            }}
            className="px-4 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-gold-400 text-xs font-medium border border-charcoal-700 transition-colors"
          >
            إعادة ضبط البحث
          </button>
        </div>
      )}
    </div>
  );
};
