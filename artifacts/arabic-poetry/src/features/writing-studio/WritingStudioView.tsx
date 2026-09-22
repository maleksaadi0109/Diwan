import React, { useState } from "react";
import { PenTool, Sidebar, BookOpen, CheckCircle2, CloudAlert, LoaderCircle } from "lucide-react";
import { useStudioDrafts } from "./hooks/useStudioDrafts";
import { DraftSidebar } from "./components/DraftSidebar";
import { RhymeFinder } from "./components/RhymeFinder";
import { VerseRow } from "./components/VerseRow";
import { Toolbar } from "./components/Toolbar";
import { ImportModal } from "./components/ImportModal";
import { cn } from "../../lib/utils";

export const WritingStudioView: React.FC = () => {
  const {
    isLoaded,
    saveStatus,
    drafts,
    activeDraft,
    activeDraftId,
    createDraft,
    switchDraft,
    updateDraft,
    deleteDraft,
    duplicateDraft,
    addVerse,
    updateVerse,
    deleteVerse,
    reorderVerse,
  } = useStudioDrafts();

  const [showDrafts, setShowDrafts] = useState(true);
  const [showRhymes, setShowRhymes] = useState(true);
  const [hideDiacritics, setHideDiacritics] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center text-ink-600 font-poetry text-xl animate-pulse">
        جاري تهيئة محترف الكتابة...
      </div>
    );
  }

  return (
    <div className="flex w-full h-full bg-charcoal-950 overflow-hidden relative">
      {/* Rhyme Finder (Right side when open, visually right in RTL) */}
      {showRhymes && (
        <RhymeFinder 
          onClose={() => setShowRhymes(false)} 
          targetRhyme={activeDraft?.targetRhyme}
          onSetTargetRhyme={(letter) => {
            if (activeDraftId) updateDraft(activeDraftId, { targetRhyme: letter });
          }}
        />
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-charcoal-900 h-full overflow-hidden">
        {/* Editor Top Bar */}
        <div className="h-16 border-b border-white/5 px-4 md:px-8 flex items-center justify-between shrink-0 bg-transparent">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "hidden lg:flex items-center gap-1.5 text-xs font-ui",
                saveStatus === "error" ? "text-crimson-500" : "text-ink-500"
              )}
              role="status"
              data-testid="status-draft-save"
            >
              {saveStatus === "saving" ? (
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              ) : saveStatus === "error" ? (
                <CloudAlert className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-700" />
              )}
              <span>
                {saveStatus === "saving"
                  ? "جارٍ الحفظ..."
                  : saveStatus === "error"
                    ? "تعذر حفظ المسودة"
                    : "محفوظة محلياً"}
              </span>
            </div>
            <button
              onClick={() => setShowDrafts(!showDrafts)}
              className={cn(
                "p-2 rounded-xl transition-colors cursor-pointer md:hidden",
                showDrafts ? "bg-accent-700/10 text-accent-500" : "bg-white/5 text-ink-500 hover:bg-white/10 hover:text-parchment-100"
              )}
            >
              <Sidebar className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowRhymes(!showRhymes)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors font-ui text-sm cursor-pointer",
                showRhymes ? "bg-accent-700/10 text-accent-500" : "bg-white/5 text-ink-500 hover:bg-white/10 hover:text-parchment-100"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">قاموس القوافي</span>
            </button>
          </div>

          <div className="flex items-center">
            {activeDraft && (
              <Toolbar 
                verses={activeDraft.verses} 
                hideDiacritics={hideDiacritics} 
                onToggleDiacritics={() => setHideDiacritics(!hideDiacritics)}
                onOpenImport={() => setShowImportModal(true)}
              />
            )}
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-y-auto relative scroll-smooth scroll-py-8">
          {activeDraft ? (
            <div className="max-w-4xl mx-auto py-12 px-4 md:px-8 flex flex-col items-center">
              {/* Title Input */}
              <input
                type="text"
                value={activeDraft.title}
                onChange={(e) => updateDraft(activeDraft.id, { title: e.target.value.slice(0, 100) })}
                maxLength={100}
                placeholder="عنوان القصيدة"
                dir="rtl"
                data-testid="input-draft-title"
                className="w-full text-center text-3xl md:text-5xl font-poetry font-bold text-accent-500 bg-transparent border-none focus:outline-none mb-16 placeholder:text-accent-700/30"
              />

              {/* Verses List */}
              <div className="w-full flex flex-col gap-6">
                {activeDraft.verses.map((verse: any, idx: number) => (
                  <VerseRow
                    key={verse.id}
                    index={idx}
                    totalVerses={activeDraft.verses.length}
                    verse={verse}
                    targetRhyme={activeDraft.targetRhyme}
                    hideDiacritics={hideDiacritics}
                    onChange={updateVerse}
                    onDelete={deleteVerse}
                    onAddAfter={addVerse}
                    onReorder={reorderVerse}
                  />
                ))}
              </div>

              {/* End of poem action */}
              <button
                onClick={() => addVerse(activeDraft.verses.length - 1)}
                className="mt-12 px-6 py-3 rounded-full border border-dashed border-white/20 text-ink-500 hover:text-accent-500 hover:border-accent-700/50 hover:bg-accent-700/5 transition-all flex items-center gap-2 font-ui cursor-pointer"
              >
                <PenTool className="w-4 h-4" />
                <span>إضافة بيت جديد</span>
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-ink-600">
              <PenTool className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-ui text-lg">اختر مسودة أو ابدأ قصيدة جديدة</p>
              <button
                onClick={createDraft}
                className="mt-6 px-6 py-2 rounded-xl bg-accent-700 text-charcoal-950 font-bold font-ui hover:bg-accent-600 transition-colors cursor-pointer"
              >
                إنشاء مسودة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Draft Sidebar (Left side visually in RTL) */}
      {showDrafts && (
        <div className="absolute inset-y-0 left-0 md:relative z-20 shadow-2xl md:shadow-none h-full transition-transform bg-charcoal-900">
          <DraftSidebar
            drafts={drafts}
            activeDraftId={activeDraftId}
            onSelect={(id) => {
              switchDraft(id);
              if (window.innerWidth < 768) setShowDrafts(false);
            }}
            onCreate={createDraft}
            onDuplicate={duplicateDraft}
            onDelete={deleteDraft}
          />
        </div>
      )}

      {showImportModal && activeDraftId && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={(importedVerses, mode) => {
            if (mode === 'replace') {
              updateDraft(activeDraftId, { verses: importedVerses });
            } else {
              updateDraft(activeDraftId, { verses: [...activeDraft!.verses, ...importedVerses].slice(0, 200) });
            }
          }}
        />
      )}
    </div>
  );
};
