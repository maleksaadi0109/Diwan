import React, { useState } from "react";
import { Verse } from "@/types";
import { ClipboardPaste, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { parsePasteExplanationText, ParsedExplanationBlock } from "@/lib/import/pasteExplanationParser";

interface ImportExplanationModalProps {
  verses: Verse[];
  onClose: () => void;
  onImport: (blocks: ParsedExplanationBlock[]) => Promise<void> | void;
}

export const ImportExplanationModal: React.FC<ImportExplanationModalProps> = ({ verses, onClose, onImport }) => {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<{ matched: ParsedExplanationBlock[]; unmatchedCount: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handlePreview = () => {
    setSaveError(null);
    setDone(false);
    try {
      const result = parsePasteExplanationText(rawText, verses);
      if (result.matched.length === 0) {
        setParseError("تعذّر مطابقة أي بيت من النص الملصق مع أبيات هذه القصيدة. تأكد من نسخ النص كاملاً كما هو.");
        setPreview(null);
        return;
      }
      setParseError(null);
      setPreview({ matched: result.matched, unmatchedCount: result.unmatchedVerseBlocks.length });
    } catch (err: unknown) {
      setParseError((err as Error).message || "تعذّر تحليل النص الملصق.");
      setPreview(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onImport(preview.matched);
      setDone(true);
    } catch (err: unknown) {
      setSaveError((err as Error).message || "تعذّر حفظ الشرح المستورد.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080A0E]/75 backdrop-blur-sm p-4 select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0E1015] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#14171E] shrink-0">
          <div className="flex items-center gap-2.5 text-[#F8F9FA] min-w-0">
            <ClipboardPaste className="w-5 h-5 text-[#D4AF37] shrink-0" />
            <h3 className="text-sm font-bold font-sans truncate">استيراد شرح جاهز (نسخ ولصق)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#6C7A8C] hover:text-[#F8F9FA] p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto select-text">
          <p className="text-xs text-[#A0AAB7] font-sans leading-relaxed">
            انسخ نص الشرح كاملاً من الموقع (ملخص القصيدة، الشرح العام، ثم كل بيت مع شرحه ومفرداته) والصقه هنا. سيحاول
            التطبيق مطابقة كل بيت في النص مع أبيات هذه القصيدة تلقائيًا.
          </p>

          <textarea
            rows={10}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setPreview(null);
              setParseError(null);
              setDone(false);
            }}
            dir="rtl"
            placeholder="الصق هنا نص الشرح كاملاً..."
            className="w-full bg-black/30 text-[#F8F9FA] placeholder-[#6C7A8C] border border-white/15 focus:border-[#D4AF37] focus:outline-none rounded-2xl p-4 text-sm font-sans leading-relaxed"
          />

          {parseError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-300 font-sans">{parseError}</p>
            </div>
          )}

          {preview && !done && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="text-xs font-bold font-sans">
                  تم العثور على شرح لـ {preview.matched.length} بيت{preview.unmatchedCount > 0 ? ` (وتعذّرت مطابقة ${preview.unmatchedCount} بيت إضافي)` : ""}.
                </p>
              </div>
              <ul className="text-[11px] text-[#A0AAB7] font-sans space-y-1 max-h-32 overflow-y-auto">
                {preview.matched.map((b) => (
                  <li key={b.verseId} className="truncate">— {b.verseText}</li>
                ))}
              </ul>
            </div>
          )}

          {saveError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4">
              <p className="text-xs text-rose-300 font-sans">{saveError}</p>
            </div>
          )}

          {done && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-2.5 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <p className="text-xs font-bold font-sans">تم حفظ الشرح بنجاح.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#14171E] flex justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-[#F8F9FA] text-xs font-bold rounded-xl transition-colors"
          >
            {done ? "إغلاق" : "إلغاء"}
          </button>
          {!done && !preview && (
            <button
              onClick={handlePreview}
              disabled={!rawText.trim()}
              className="px-4 py-2 bg-white/[0.1] hover:bg-white/[0.15] disabled:opacity-50 text-[#F8F9FA] text-xs font-bold rounded-xl transition-colors"
            >
              معاينة المطابقة
            </button>
          )}
          {!done && preview && (
            <button
              onClick={handleConfirmImport}
              disabled={isSaving}
              className="px-4 py-2 bg-[#D4AF37] hover:bg-[#E6C265] disabled:opacity-60 text-[#0A0C10] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>حفظ الشرح المستورد</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
