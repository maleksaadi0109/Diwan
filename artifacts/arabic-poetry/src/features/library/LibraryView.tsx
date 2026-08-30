import React, { useState, useMemo } from "react";
import { Poem, Era } from "@/types";
import { SearchBar } from "./SearchBar";
import { FilterPills } from "./FilterPills";
import { PoemCard } from "./PoemCard";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";
import { BookOpen, Plus, Feather, Sparkles, ListChecks, ListPlus, X } from "lucide-react";

interface LibraryViewProps {
  poems: Poem[];
  onOpenPoem: (poem: Poem) => void;
  onNavigateToImport: () => void;
  onDeletePoem?: (poemId: string) => void;
  onAddToPlaylist?: (poem: Poem) => void;
  onBulkAddToPlaylist?: (poems: Poem[]) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  poems,
  onOpenPoem,
  onNavigateToImport,
  onDeletePoem,
  onAddToPlaylist,
  onBulkAddToPlaylist,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEra, setSelectedEra] = useState<Era | "الكل">("الكل");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const toggleSelect = (poemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(poemId)) next.delete(poemId);
      else next.add(poemId);
      return next;
    });
  };

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
    <div className="h-full flex flex-col overflow-y-auto px-4 md:px-14 py-8 md:py-10 max-w-7xl mx-auto w-full scroll-smooth select-none pb-24 md:pb-28">
      {/* Hero / Header Section */}
      <div className="mb-10 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold text-accent-700 flex items-center gap-1.5 font-sans bg-accent-700/10 px-3 py-1 rounded-full border border-accent-700/20">
                <Feather className="w-3.5 h-3.5" />
                <span>الديوان الجامع للشعر العربي والمحاذاة الصوتية</span>
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-poetry font-bold text-parchment-100 tracking-wide mt-2 flex items-center gap-3">
              <span>المكتبة</span>
              <Sparkles className="w-6 h-6 text-accent-700" />
            </h2>
            <p className="text-sm text-ink-500 mt-2 font-sans max-w-lg">
              تصفح عيون الشعر العربي، واستمع إلى الإلقاء الصوتي المتزامن بدقة عالية
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onBulkAddToPlaylist && (
              <button
                onClick={toggleSelectionMode}
                className={`px-5 py-2.5 font-bold font-sans text-xs transition-all rounded-xl flex items-center justify-center gap-2 cursor-pointer border focus-visible:ring-2 focus-visible:ring-accent-700 ${
                  selectionMode
                    ? "bg-accent-700/10 text-accent-600 border-accent-700/30"
                    : "bg-white/5 text-ink-500 border-white/5 hover:text-ink-900 hover:bg-white/10 hover:border-white/10"
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>{selectionMode ? "إلغاء التحديد" : "تحديد متعدد"}</span>
              </button>
            )}
            <button
              onClick={onNavigateToImport}
              className="px-5 py-2.5 bg-accent-700 hover:bg-accent-600 text-charcoal-950 font-bold font-sans text-xs transition-all rounded-xl flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:ring-accent-700 shadow-lg shadow-accent-700/20"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden sm:inline">استيراد قصيدة</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-charcoal-850 p-2 md:p-3 rounded-2xl border border-white/5 shadow-md">
          <div className="flex-1">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="w-px h-8 bg-white/10 hidden md:block" />
          <FilterPills selectedEra={selectedEra} onSelectEra={setSelectedEra} />
        </div>
      </div>

      {/* Counter summary */}
      <div className="flex items-center justify-between text-xs text-ink-500 mb-6 pb-3 border-b border-white/5 font-sans">
        <span>
          عرض <strong className="text-parchment-100 px-1 font-mono">{toArabicDigits(filteredPoems.length)}</strong> من إجمالي <strong className="text-parchment-100 px-1 font-mono">{toArabicDigits(poems.length)}</strong> قصائد
        </span>
      </div>

      {/* Grid of Poem Cards */}
      {filteredPoems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 animate-fade-in">
          {filteredPoems.map((poem) => (
            <PoemCard
              key={poem.id}
              poem={poem}
              onOpenPoem={onOpenPoem}
              onDeletePoem={onDeletePoem}
              onAddToPlaylist={onAddToPlaylist}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(poem.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 md:p-16 bg-charcoal-850/50 border border-white/5 rounded-3xl animate-fade-in">
          <div className="w-16 h-16 bg-charcoal-800 border border-white/5 flex items-center justify-center mb-5 text-accent-700 rounded-2xl shadow-inner">
            <BookOpen className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-poetry font-bold text-parchment-100 mb-2">
            لا توجد قصائد مطابقة لبحثك
          </h3>
          <p className="text-sm text-ink-500 max-w-md mb-6 leading-relaxed font-sans">
            جرب تعديل كلمات البحث أو تصفية العصور، أو أضف قصيدة جديدة إلى ديوانك.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedEra("الكل");
            }}
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-ink-900 font-bold font-sans text-xs transition-colors rounded-xl cursor-pointer"
          >
            إعادة ضبط البحث
          </button>
        </div>
      )}

      {/* Floating bulk-action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-charcoal-800 border border-accent-700/30 rounded-2xl px-5 py-3 shadow-2xl animate-slide-up">
          <span className="text-xs font-bold text-accent-500 font-sans whitespace-nowrap">
            {toArabicDigits(selectedIds.size)} محدد
          </span>
          <div className="w-px h-6 bg-white/10" />
          <button
            onClick={() => {
              const selectedPoems = poems.filter((p) => selectedIds.has(p.id));
              onBulkAddToPlaylist?.(selectedPoems);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent-700 hover:bg-accent-600 text-charcoal-950 font-bold font-sans text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            <ListPlus className="w-4 h-4" />
            <span>إضافة إلى قائمة تشغيل</span>
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-2 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-white/5 transition-colors cursor-pointer"
            title="إلغاء التحديد"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
