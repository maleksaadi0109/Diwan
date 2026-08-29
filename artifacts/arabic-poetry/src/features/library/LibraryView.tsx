import React, { useState, useMemo } from "react";
import { Poem, Era } from "@/types";
import { SearchBar } from "./SearchBar";
import { FilterPills } from "./FilterPills";
import { PoemCard } from "./PoemCard";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";
import { BookOpen, Plus, Sparkles } from "lucide-react";

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
              <span className="text-xs font-semibold text-[#D4AF37] tracking-widest uppercase flex items-center gap-1.5 bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-md border border-[#D4AF37]/20">
                <Sparkles className="w-3 h-3" />
                <span>الديوان الجامع للشعر العربي</span>
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[#F8F9FA] font-poetry tracking-wide drop-shadow-md">
              المكتبة
            </h2>
            <p className="text-sm text-[#A0AAB7] mt-2 font-sans tracking-wide">
              تصفح عيون الشعر العربي، واستمع إلى الإلقاء الصوتي المتزامن بدقة عالية
            </p>
          </div>

          <button
            onClick={onNavigateToImport}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] text-[#0A0C10] font-bold text-sm transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center gap-2 border border-[#F3E19C]/40 group active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3] group-hover:rotate-90 transition-transform duration-300" />
            <span>استيراد قصيدة</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-[#13161D]/80 p-3 rounded-2xl border border-white/[0.08] shadow-xl backdrop-blur-xl">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="w-[1px] h-8 bg-white/[0.1] hidden md:block" />
          <FilterPills selectedEra={selectedEra} onSelectEra={setSelectedEra} />
        </div>
      </div>

      {/* Counter summary */}
      <div className="flex items-center justify-between text-xs text-[#A0AAB7] mb-6 pb-3 border-b border-white/[0.08] font-sans tracking-wide">
        <span>
          عرض <strong className="text-[#F3E19C] px-1 font-mono text-sm">{toArabicDigits(filteredPoems.length)}</strong> من إجمالي <strong className="text-[#F8F9FA] px-1 font-mono text-sm">{toArabicDigits(poems.length)}</strong> قصائد
        </span>
      </div>

      {/* Grid of Poem Cards */}
      {filteredPoems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-16">
          {filteredPoems.map((poem) => (
            <PoemCard key={poem.id} poem={poem} onOpenPoem={onOpenPoem} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-16 bg-[#13161D]/50 border border-white/[0.08] rounded-3xl backdrop-blur-md shadow-2xl">
          <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6 text-[#D4AF37]/60 shadow-inner">
             <BookOpen className="w-10 h-10" strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-bold text-[#F8F9FA] mb-2 font-poetry tracking-wide">
            لا توجد قصائد مطابقة لبحثك
          </h3>
          <p className="text-sm text-[#A0AAB7] max-w-sm mb-6 leading-relaxed">
            جرب تعديل كلمات البحث أو تصفية العصور، أو أضف قصيدة جديدة إلى ديوانك.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedEra("الكل");
            }}
            className="px-6 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-[#F8F9FA] text-sm font-medium border border-white/10 transition-colors shadow-sm"
          >
            إعادة ضبط البحث
          </button>
        </div>
      )}
    </div>
  );
};
