import React, { useState, useMemo } from "react";
import { Poem, Era } from "@/types";
import { SearchBar } from "./SearchBar";
import { FilterPills } from "./FilterPills";
import { PoemCard } from "./PoemCard";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";
import { BookOpen, Plus, Feather, Sparkles, ListChecks, ListPlus, X, Trash2, AlertTriangle, CheckSquare, Square } from "lucide-react";

interface LibraryViewProps {
  poems: Poem[];
  onOpenPoem: (poem: Poem) => void;
  onNavigateToImport: () => void;
  onDeletePoem?: (poemId: string) => void;
  onBulkDeletePoems?: (poemIds: string[]) => void;
  onAddToPlaylist?: (poem: Poem) => void;
  onBulkAddToPlaylist?: (poems: Poem[]) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  poems,
  onOpenPoem,
  onNavigateToImport,
  onDeletePoem,
  onBulkDeletePoems,
  onAddToPlaylist,
  onBulkAddToPlaylist,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEra, setSelectedEra] = useState<Era | "الكل">("الكل");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false);

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

  const allFilteredSelected = filteredPoems.length > 0 && filteredPoems.every((p) => selectedIds.has(p.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPoems.map((p) => p.id)));
    }
  };

  const handleExecuteBulkDelete = () => {
    if (onBulkDeletePoems && selectedIds.size > 0) {
      onBulkDeletePoems(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
    setShowConfirmBulkDelete(false);
  };

  const hasPoems = poems.length > 0;

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

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {hasPoems && (onBulkAddToPlaylist || onBulkDeletePoems) && (
              <>
                {selectionMode && filteredPoems.length > 0 && (
                  <button
                    onClick={handleToggleSelectAll}
                    className="px-4 py-2.5 font-bold font-sans text-xs transition-all rounded-xl flex items-center justify-center gap-2 cursor-pointer border border-white/10 bg-white/5 hover:bg-white/10 text-ink-500 hover:text-parchment-100"
                  >
                    {allFilteredSelected ? (
                      <>
                        <Square className="w-4 h-4 text-accent-600" />
                        <span>إلغاء تحديد الكل</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-4 h-4 text-accent-600" />
                        <span>تحديد الكل</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={toggleSelectionMode}
                  className={`px-5 py-2.5 font-bold font-sans text-xs transition-all rounded-xl flex items-center justify-center gap-2 cursor-pointer border focus-visible:ring-2 focus-visible:ring-accent-700 ${
                    selectionMode
                      ? "bg-accent-700/10 text-accent-600 border-accent-700/30"
                      : "bg-white/5 text-ink-500 border-white/5 hover:text-ink-900 hover:bg-white/10 hover:border-white/10"
                  }`}
                >
                  <ListChecks className="w-4 h-4" />
                  <span>{selectionMode ? "إنهاء التحديد" : "تحديد متعدد"}</span>
                </button>
              </>
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
        {hasPoems && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-charcoal-850 p-2 md:p-3 rounded-2xl border border-white/5 shadow-md">
            <div className="flex-1">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
            <div className="w-px h-8 bg-white/10 hidden md:block" />
            <FilterPills selectedEra={selectedEra} onSelectEra={setSelectedEra} />
          </div>
        )}
      </div>

      {/* Counter summary */}
      {hasPoems && (
        <div className="flex items-center justify-between text-xs text-ink-500 mb-6 pb-3 border-b border-white/5 font-sans">
          <span>
            عرض <strong className="text-parchment-100 px-1 font-mono">{toArabicDigits(filteredPoems.length)}</strong> من إجمالي <strong className="text-parchment-100 px-1 font-mono">{toArabicDigits(poems.length)}</strong> قصائد
          </span>
          {selectionMode && selectedIds.size > 0 && (
            <span className="text-accent-500 font-bold">
              تم تحديد {toArabicDigits(selectedIds.size)} قصيدة
            </span>
          )}
        </div>
      )}

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
      ) : hasPoems ? (
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
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 md:p-20 bg-charcoal-850/40 border border-white/5 rounded-3xl animate-fade-in my-auto">
          <div className="w-20 h-20 bg-charcoal-800 border border-white/5 flex items-center justify-center mb-6 text-accent-700 rounded-3xl shadow-inner">
            <Feather className="w-10 h-10" strokeWidth={1.5} />
          </div>
          <h3 className="text-3xl font-poetry font-bold text-parchment-100 mb-3">
            المكتبة فارغة حالياً
          </h3>
          <p className="text-sm md:text-base text-ink-500 max-w-lg mb-8 leading-relaxed font-sans">
            لا توجد أي قصائد في ديوانك. يمكنك الآن استيراد قصائد جديدة مع ملفاتها الصوتية أو إدخال نصوصك المخصصة.
          </p>
          <button
            onClick={onNavigateToImport}
            className="px-8 py-3.5 bg-accent-700 hover:bg-accent-600 text-charcoal-950 font-bold font-sans text-sm transition-all rounded-2xl cursor-pointer shadow-xl shadow-accent-700/20 flex items-center gap-2.5"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span>استيراد قصيدة جديدة</span>
          </button>
        </div>
      )}

      {/* Floating bulk-action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-charcoal-800/95 backdrop-blur-xl border border-accent-700/30 rounded-2xl px-5 py-3 shadow-2xl animate-slide-up max-w-[90vw]">
          <span className="text-xs font-bold text-accent-500 font-sans whitespace-nowrap">
            {toArabicDigits(selectedIds.size)} محدد
          </span>
          <div className="w-px h-6 bg-white/10" />

          {onBulkAddToPlaylist && (
            <button
              onClick={() => {
                const selectedPoems = poems.filter((p) => selectedIds.has(p.id));
                onBulkAddToPlaylist?.(selectedPoems);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-accent-700 hover:bg-accent-600 text-charcoal-950 font-bold font-sans text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md"
            >
              <ListPlus className="w-4 h-4" />
              <span className="hidden sm:inline">إضافة إلى قائمة</span>
              <span className="sm:hidden">إضافة</span>
            </button>
          )}

          {onBulkDeletePoems && (
            <button
              onClick={() => setShowConfirmBulkDelete(true)}
              className="flex items-center gap-2 px-4 py-2 bg-crimson-600/20 hover:bg-crimson-600 text-crimson-400 hover:text-white border border-crimson-500/30 font-bold font-sans text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المحدد ({toArabicDigits(selectedIds.size)})</span>
            </button>
          )}

          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-2 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-white/5 transition-colors cursor-pointer"
            title="إلغاء التحديد"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showConfirmBulkDelete && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-charcoal-900 border border-crimson-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-crimson-500">
              <div className="p-3 bg-crimson-500/10 rounded-2xl border border-crimson-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-parchment-100 font-heading">
                  تأكيد حذف القصائد
                </h3>
                <p className="text-xs text-crimson-400 font-sans mt-0.5">
                  حذف نهائي لا يمكن التراجع عنه
                </p>
              </div>
            </div>

            <p className="text-sm text-ink-400 font-sans leading-relaxed">
              هل أنت متأكد من رغبتك في حذف <strong className="text-parchment-100 font-bold">{toArabicDigits(selectedIds.size)}</strong> قصيدة محددة؟ سيتم حذف جميع الأبيات والتسجيلات والمحاذاة المرتبطة بها من التطبيق.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 font-sans">
              <button
                type="button"
                onClick={() => setShowConfirmBulkDelete(false)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-ink-500 hover:text-parchment-100 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkDelete}
                className="px-6 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-crimson-600/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
