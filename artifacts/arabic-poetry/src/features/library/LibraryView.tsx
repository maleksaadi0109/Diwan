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
    <div className="h-full flex flex-col overflow-y-auto px-10 py-10 max-w-7xl mx-auto w-full scroll-smooth">
      {/* Top Section */}
      <div className="mb-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-ink-950 font-poetry tracking-wide">
              المكتبة
            </h2>
            <p className="text-sm text-ink-500 mt-2 font-sans tracking-wide">
              تصفح القصائد المحفوظة والمحاذاة صوتياً
            </p>
          </div>
          <button
            onClick={onNavigateToImport}
            className="px-5 py-2.5 rounded-lg bg-crimson-800 hover:bg-crimson-700 text-sand-50 font-semibold text-sm transition-all shadow-md flex items-center gap-2 border border-crimson-900 group"
          >
            <span className="text-lg font-light group-hover:scale-110 transition-transform">+</span>
            <span>استيراد قصيدة</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-sand-200/50 p-2 rounded-xl border border-sand-300">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="w-[1px] h-8 bg-sand-300 hidden md:block"></div>
          <FilterPills selectedEra={selectedEra} onSelectEra={setSelectedEra} />
        </div>
      </div>

      {/* Counter summary */}
      <div className="flex items-center justify-between text-xs text-ink-500 mb-6 pb-3 border-b border-sand-300 font-sans tracking-wide">
        <span>
          عرض <strong className="text-ink-800 px-1">{toArabicDigits(filteredPoems.length)}</strong> من إجمالي <strong className="text-ink-800 px-1">{toArabicDigits(poems.length)}</strong> قصائد
        </span>
      </div>

      {/* Grid of Poem Cards */}
      {filteredPoems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {filteredPoems.map((poem, index) => (
            <div key={poem.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
              <PoemCard poem={poem} onOpenPoem={onOpenPoem} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-16 bg-sand-100/50 border border-sand-300/80 rounded-2xl shadow-inner">
          <div className="w-20 h-20 rounded-full bg-sand-200 flex items-center justify-center mb-6 shadow-sm border border-sand-300">
             <BookOpen className="w-10 h-10 text-ink-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-ink-800 mb-2 font-poetry tracking-wide">
            لا توجد قصائد مطابقة لبحثك
          </h3>
          <p className="text-sm text-ink-500 max-w-sm mb-6 leading-relaxed">
            جرب تعديل كلمات البحث أو تصفية العصور، أو أضف قصيدة جديدة إلى ديوانك.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedEra("الكل");
            }}
            className="px-6 py-2.5 rounded-lg bg-sand-200 hover:bg-sand-300 text-ink-800 text-sm font-medium border border-sand-400 transition-colors shadow-sm"
          >
            إعادة ضبط البحث
          </button>
        </div>
      )}
    </div>
  );
};
