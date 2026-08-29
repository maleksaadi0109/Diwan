import React, { useState, useMemo } from "react";
import { Poem, Era } from "@/types";
import { SearchBar } from "./SearchBar";
import { FilterPills } from "./FilterPills";
import { PoemCard } from "./PoemCard";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";
import { BookOpen, Plus, Feather } from "lucide-react";

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
      if (selectedEra !== "الكل" && poem.era !== selectedEra) {
        return false;
      }
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
    <div className="h-full flex flex-col overflow-y-auto px-8 md:px-12 py-10 max-w-7xl mx-auto w-full scroll-smooth">
      {/* Hero / Header Section */}
      <div className="mb-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-accent-700 flex items-center gap-1.5 font-ui">
                <Feather className="w-4 h-4" />
                <span>الديوان الجامع للشعر العربي</span>
              </span>
            </div>
            <h2 className="text-5xl font-heading text-ink-900 mt-2">
              المكتبة
            </h2>
            <p className="text-[15px] text-ink-600 mt-3 font-ui">
              تصفح عيون الشعر العربي، واستمع إلى الإلقاء الصوتي المتزامن بدقة عالية
            </p>
          </div>

          <button
            onClick={onNavigateToImport}
            className="px-6 py-2.5 bg-paper-100 border-2 border-accent-700 text-accent-700 font-bold font-ui text-sm hover:bg-accent-700 hover:text-paper-100 transition-colors shadow-sm rounded-none flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>استيراد قصيدة</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-paper-100 p-2 border border-paper-400 shadow-sm rounded-none relative">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="w-px h-8 bg-paper-400 hidden md:block" />
          <FilterPills selectedEra={selectedEra} onSelectEra={setSelectedEra} />
        </div>
      </div>

      {/* Counter summary */}
      <div className="flex items-center justify-between text-sm text-ink-600 mb-6 pb-3 border-b border-paper-400 font-ui">
        <span>
          عرض <strong className="text-ink-900 px-1 font-mono">{toArabicDigits(filteredPoems.length)}</strong> من إجمالي <strong className="text-ink-900 px-1 font-mono">{toArabicDigits(poems.length)}</strong> قصائد
        </span>
      </div>

      {/* Grid of Poem Cards */}
      {filteredPoems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-16">
          {filteredPoems.map((poem) => (
            <PoemCard key={poem.id} poem={poem} onOpenPoem={onOpenPoem} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-16 bg-paper-100 border border-paper-400 shadow-sm rounded-none">
          <div className="w-20 h-20 bg-paper-200 border border-paper-400 flex items-center justify-center mb-6 text-ink-500 rounded-none">
             <BookOpen className="w-10 h-10" strokeWidth={1.5} />
          </div>
          <h3 className="text-3xl font-heading text-ink-900 mb-3">
            لا توجد قصائد مطابقة لبحثك
          </h3>
          <p className="text-md text-ink-600 max-w-md mb-6 leading-relaxed font-ui">
            جرب تعديل كلمات البحث أو تصفية العصور، أو أضف قصيدة جديدة إلى ديوانك.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedEra("الكل");
            }}
            className="px-6 py-2.5 border border-ink-600 text-ink-800 font-bold font-ui text-sm hover:bg-ink-800 hover:text-paper-100 transition-colors shadow-sm rounded-none"
          >
            إعادة ضبط البحث
          </button>
        </div>
      )}
    </div>
  );
};
