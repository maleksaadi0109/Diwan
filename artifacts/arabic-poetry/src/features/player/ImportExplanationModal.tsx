import React, { useState } from "react";
import { Verse, VerseSegmentationSuggestion } from "@/types";
import { ClipboardPaste, X, CheckCircle2, AlertTriangle, Loader2, Clipboard, Wand2 } from "lucide-react";
import { parsePasteExplanationText, ParsedExplanationBlock } from "@/lib/import/pasteExplanationParser";

interface ImportExplanationModalProps {
  verses: Verse[];
  onClose: () => void;
  onImport: (blocks: ParsedExplanationBlock[]) => Promise<void> | void;
  onApplySuggestions?: (accepted: VerseSegmentationSuggestion[]) => Promise<void> | void;
}

const SUGGESTION_LABELS: Record<VerseSegmentationSuggestion["kind"], string> = {
  hemistich_split: "تصحيح تقسيم الشطرين",
  merge_verses: "دمج بيتين في بيت واحد",
  split_verse: "تقسيم بيت إلى بيتين",
};

export const ImportExplanationModal: React.FC<ImportExplanationModalProps> = ({
  verses,
  onClose,
  onImport,
  onApplySuggestions,
}) => {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState<{
    matched: ParsedExplanationBlock[];
    unmatchedCount: number;
    suggestions: VerseSegmentationSuggestion[];
  } | null>(null);
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState<Set<string>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  const handlePasteFromClipboard = async () => {
    setClipboardError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setClipboardError("الحافظة فارغة — انسخ النص أولاً من الموقع.");
        return;
      }
      setRawText(text);
      setPreview(null);
      setParseError(null);
      setDone(false);
    } catch {
      setClipboardError("تعذّر الوصول إلى الحافظة تلقائيًا. الصق النص يدويًا في الصندوق أدناه (Ctrl+V).");
    }
  };

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
      setPreview({
        matched: result.matched,
        unmatchedCount: result.unmatchedVerseBlocks.length,
        suggestions: result.segmentationSuggestions,
      });
      // Suggestions default to accepted — the user reviews and unchecks any they disagree with.
      setAcceptedSuggestionIds(new Set(result.segmentationSuggestions.map((s) => s.id)));
    } catch (err: unknown) {
      setParseError((err as Error).message || "تعذّر تحليل النص الملصق.");
      setPreview(null);
    }
  };

  const toggleSuggestion = (id: string) => {
    setAcceptedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onImport(preview.matched);
      const accepted = preview.suggestions.filter((s) => acceptedSuggestionIds.has(s.id));
      if (accepted.length > 0 && onApplySuggestions) {
        await onApplySuggestions(accepted);
      }
      setDone(true);
    } catch (err: unknown) {
      setSaveError((err as Error).message || "تعذّر حفظ الشرح المستورد.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/75 backdrop-blur-sm p-4 select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-charcoal-950 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-charcoal-900 shrink-0">
          <div className="flex items-center gap-2.5 text-parchment-100 min-w-0">
            <ClipboardPaste className="w-5 h-5 text-accent-700 shrink-0" />
            <h3 className="text-sm font-bold font-sans truncate">استيراد شرح جاهز (نسخ ولصق)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-parchment-100 p-1.5 rounded-xl hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto select-text">
          <div className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-accent-500 font-sans">الخطوات:</p>
            <ol className="text-xs text-ink-500 font-sans leading-relaxed list-decimal pr-4 space-y-1">
              <li>افتح صفحة شرح القصيدة في الموقع المصدر.</li>
              <li>حدد كل نص الصفحة (Ctrl+A) وانسخه (Ctrl+C).</li>
              <li>ارجع هنا واضغط "لصق من الحافظة"، أو الصق يدويًا (Ctrl+V) في الصندوق أدناه.</li>
            </ol>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/[0.14] text-parchment-100 transition-colors"
            >
              <Clipboard className="w-3.5 h-3.5 text-accent-700" />
              <span>لصق من الحافظة</span>
            </button>
            {clipboardError && <p className="text-[11px] text-amber-400 font-sans">{clipboardError}</p>}
          </div>

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
            className="w-full bg-black/30 text-parchment-100 placeholder-ink-500 border border-white/15 focus:border-accent-700 focus:outline-none rounded-2xl p-4 text-sm font-sans leading-relaxed"
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
              <ul className="text-[11px] text-ink-500 font-sans space-y-1 max-h-32 overflow-y-auto">
                {preview.matched.map((b) => (
                  <li key={b.verseId} className="truncate">— {b.verseText}</li>
                ))}
              </ul>
            </div>
          )}

          {preview && preview.suggestions.length > 0 && !done && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-300">
                <Wand2 className="w-4 h-4 shrink-0" />
                <p className="text-xs font-bold font-sans">
                  الشرح كشف {preview.suggestions.length} احتمال خطأ في تقسيم الأبيات — راجع واختر ما تريد تصحيحه:
                </p>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {preview.suggestions.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-start gap-2.5 bg-black/20 border border-white/5 rounded-xl p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={acceptedSuggestionIds.has(s.id)}
                      onChange={() => toggleSuggestion(s.id)}
                      className="mt-0.5 accent-accent-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-[11px] font-bold text-accent-500 font-sans">
                        {SUGGESTION_LABELS[s.kind]}
                      </p>
                      <p className="text-[11px] text-ink-500 font-sans">{s.description}</p>
                      <div className="grid grid-cols-1 gap-1.5 text-[11px] font-sans">
                        <div className="bg-rose-500/10 rounded-lg p-2 text-rose-300/90">
                          <span className="text-[10px] font-bold block mb-0.5">الحالي:</span>
                          {s.current.map((pair, idx) => (
                            <p key={idx} className="truncate">{pair.firstHemistich} … {pair.secondHemistich}</p>
                          ))}
                        </div>
                        <div className="bg-emerald-500/10 rounded-lg p-2 text-emerald-300/90">
                          <span className="text-[10px] font-bold block mb-0.5">المقترح:</span>
                          {s.suggested.map((pair, idx) => (
                            <p key={idx} className="truncate">{pair.firstHemistich} … {pair.secondHemistich}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
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
        <div className="px-6 py-4 border-t border-white/10 bg-charcoal-900 flex justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-parchment-100 text-xs font-bold rounded-xl transition-colors"
          >
            {done ? "إغلاق" : "إلغاء"}
          </button>
          {!done && !preview && (
            <button
              onClick={handlePreview}
              disabled={!rawText.trim()}
              className="px-4 py-2 bg-white/10 hover:bg-white/[0.15] disabled:opacity-50 text-parchment-100 text-xs font-bold rounded-xl transition-colors"
            >
              معاينة المطابقة
            </button>
          )}
          {!done && preview && (
            <button
              onClick={handleConfirmImport}
              disabled={isSaving}
              className="px-4 py-2 bg-accent-700 hover:bg-accent-600 disabled:opacity-60 text-charcoal-950 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
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
