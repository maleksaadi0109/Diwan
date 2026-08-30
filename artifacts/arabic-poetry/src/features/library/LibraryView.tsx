import React, { useState, useMemo } from "react";
import { Poem, Era } from "@/types";
import { SearchBar } from "./SearchBar";
import { FilterPills } from "./FilterPills";
import { PoemCard } from "./PoemCard";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";
import { BookOpen, Plus, Feather, Sparkles } from "lucide-react";

interface LibraryViewProps {
  poems: Poem[];
  onOpenPoem: (poem: Poem) => void;
  onNavigateToImport: () => void;
  onDeletePoem?: (poemId: string) => void;
  onAddToPlaylist?: (poem: Poem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  poems,
  onOpenPoem,
  onNavigateToImport,
  onDeletePoem,
  onAddToPlaylist,
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
    <div className="h-full flex flex-col overflow-y-auto px-8 md:px-14 py-10 max-w-7xl mx-auto w-full scroll-smooth select-none text-[#F8F9FA]">
      {/* Hero / Header Section */}
      <div className="mb-10 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5 font-sans bg-[#D4AF37]/10 px-3 py-1 rounded-xl border border-[#D4AF37]/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]">
                <Feather className="w-3.5 h-3.5" />
                <span>الديوان الجامع للشعر العربي والمحاذاة الصوتية</span>
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-poetry font-bold text-[#F8F9FA] tracking-wide mt-2 flex items-center gap-3">
              <span>المكتبة</span>
              <Sparkles className="w-6 h-6 text-[#D4AF37]" />
            </h2>
            <p className="text-xs md:text-sm text-[#A0AAB7] mt-2 font-sans">
              تصفح عيون الشعر العربي، واستمع إلى الإلقاء الصوتي المتزامن بدقة عالية
            </p>
          </div>

          <button
            onClick={onNavigateToImport}
            className="px-6 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] text-[#0A0C10] font-bold font-sans text-xs transition-all shadow-[0_0_20px_rgba(212,175,55,0.35)] rounded-2xl flex items-center justify-center gap-2 group shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>استيراد قصيدة جديدة</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-[#14171E]/90 p-3 rounded-2xl border border-white/[0.08] shadow-xl backdrop-blur-xl">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="w-px h-8 bg-white/10 hidden md:block" />
          <FilterPills selectedEra={selectedEra} onSelectEra={setSelectedEra} />
        </div>
      </div>

      {/* Counter summary */}
      <div className="flex items-center justify-between text-xs text-[#A0AAB7] mb-6 pb-3 border-b border-white/[0.08] font-sans">
        <span>
          عرض <strong className="text-[#F8F9FA] px-1 font-mono">{toArabicDigits(filteredPoems.length)}</strong> من إجمالي <strong className="text-[#F8F9FA] px-1 font-mono">{toArabicDigits(poems.length)}</strong> قصائد
        </span>
      </div>

      {/* Grid of Poem Cards */}
      {filteredPoems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {filteredPoems.map((poem) => (
            <PoemCard
              key={poem.id}
              poem={poem}
              onOpenPoem={onOpenPoem}
              onDeletePoem={onDeletePoem}
              onAddToPlaylist={onAddToPlaylist}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-16 bg-[#14171E]/60 border border-white/[0.08] rounded-3xl shadow-xl">
          <div className="w-16 h-16 bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5 text-[#D4AF37] rounded-2xl shadow-inner">
            <BookOpen className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-poetry font-bold text-[#F8F9FA] mb-2">
            لا توجد قصائد مطابقة لبحثك
          </h3>
          <p className="text-xs text-[#A0AAB7] max-w-md mb-6 leading-relaxed font-sans">
            جرب تعديل كلمات البحث أو تصفية العصور، أو أضف قصيدة جديدة إلى ديوانك.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedEra("الكل");
            }}
            className="px-6 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[#F8F9FA] font-bold font-sans text-xs transition-colors rounded-xl cursor-pointer"
          >
            إعادة ضبط البحث
          </button>
        </div>
      )}
    </div>
  );
};
