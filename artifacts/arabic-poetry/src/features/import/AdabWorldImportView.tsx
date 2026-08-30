import React, { useState } from "react";
import { AdabWorldProvider, AdabWorldPoemData } from "@/lib/providers/AdabWorldProvider";
import { Poem } from "@/types";
import { BookMarked, Search, BookOpen, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";

interface AdabWorldImportViewProps {
  onPoemImported: (poem: Poem) => void;
}

export const AdabWorldImportView: React.FC<AdabWorldImportViewProps> = ({ onPoemImported }) => {
  const [url, setUrl] = useState("");
  const [provider] = useState(() => new AdabWorldProvider());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<AdabWorldPoemData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFetchPreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setPreviewData(null);
    setSuccessMessage(null);

    try {
      const data = await provider.fetchPoemData(url.trim());
      setPreviewData(data);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "تعذر جلب بيانات القصيدة من عالَم الأدب");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportPoem = async () => {
    if (!previewData) return;

    setIsSaving(true);
    setError(null);

    try {
      const parsed = provider.mapDataToPayload(previewData);
      const explanationsMap = provider.buildVerseExplanations(previewData);
      const poemId = `poem-adabworld-${Date.now()}`;
      const poetId = `poet-adabworld-${normalizeArabic(parsed.poetName)}`;

      const newPoem: Poem = {
        id: poemId,
        title: parsed.title,
        poet: {
          id: poetId,
          name: parsed.poetName,
          era: parsed.era,
        },
        era: parsed.era,
        bahr: parsed.bahr,
        rhyme: parsed.rhyme,
        description: parsed.description,
        versesCount: parsed.verses.length,
        externalProvider: "adab_world",
        sourceUrl: url.trim(),
        tags: ["عالَم الأدب", `بحر ${parsed.bahr}`],
        verses: parsed.verses.map((v) => ({
          id: `v-adabworld-${poemId}-${v.orderIndex}`,
          poemId,
          orderIndex: v.orderIndex,
          text: v.text,
          normalizedText: normalizeArabic(v.text),
          firstHemistich: v.firstHemistich,
          secondHemistich: v.secondHemistich,
          externalId: v.externalId,
          explanations: explanationsMap.get(v.externalId || "") || undefined,
        })),
        recordings: [],
      };

      onPoemImported(newPoem);
      setSuccessMessage(`تم استيراد قصيدة "${newPoem.title}" بنجاح (${newPoem.versesCount} بيت)`);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "فشلت عملية حفظ القصيدة");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-paper-100 border border-paper-400 rounded-none space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-none bg-accent-700/15 border border-accent-700/30 flex items-center justify-center text-accent-700">
          <BookMarked className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink-900 font-heading">
            استيراد من عالَم الأدب (Adab World)
          </h3>
          <p className="text-xs text-ink-600">
            جلب النص مع ملخص القصيدة وتحليل الجماليات البلاغية والأسلوبية
          </p>
        </div>
      </div>

      {/* Notice: unverified source */}
      <div className="p-3 bg-amber-800/10 border border-amber-700/30 rounded-none text-amber-200 text-[11px] flex items-start gap-2 select-text">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
        <span>
          هذا المصدر يحتمي بحماية آلية ضد الروبوتات، وقد يرفض الطلب أحيانًا (خصوصًا من الشبكات السحابية). إذا
          فشل الجلب، جرّب مرة أخرى لاحقًا.
        </span>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleFetchPreview} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://adabworld.com/poems/ttawl-lylk-balathmd-blgg5d"
          className="flex-1 bg-paper-200 text-ink-900 placeholder-ink-500 border border-paper-500 rounded-none px-4 py-2.5 text-xs focus:outline-none focus:border-accent-700 ltr-num"
        />
        <button
          type="submit"
          disabled={!url.trim() || isLoading || isSaving}
          className="px-4 py-2.5 rounded-none bg-accent-700 hover:bg-accent-700 disabled:opacity-50 text-paper-100 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>جلب ومعاينة</span>
        </button>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-red-800/15 border border-red-800/30 rounded-none text-rose-300 text-xs flex items-center gap-2 select-text">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3.5 bg-green-700/15 border border-green-700/30 rounded-none text-emerald-300 text-xs flex items-center gap-2 select-text">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-800" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Preview Card */}
      {previewData && (
        <div className="p-5 bg-paper-200 rounded-none border border-paper-400 space-y-4 animate-fadeIn select-text">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-heading text-lg font-bold text-ink-900">{previewData.title}</h4>
              <p className="text-xs text-accent-700 font-medium mt-1 flex items-center gap-2 flex-wrap">
                <span>{previewData.poetName}</span>
                {previewData.meterName && (
                  <>
                    <span>•</span>
                    <span>بحر {previewData.meterName}</span>
                  </>
                )}
                <span>•</span>
                <span>{toArabicDigits(previewData.verses.length)} بيت</span>
                {previewData.rhetoricalAnalysis && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[#D4AF37]">
                      <Sparkles className="w-3 h-3" /> تحليل بلاغي مرفق
                    </span>
                  </>
                )}
              </p>
            </div>

            <button
              onClick={handleImportPoem}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-none bg-accent-700 hover:bg-accent-700 text-paper-100 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
              <span>{isSaving ? "جاري الاستيراد..." : "تأكيد واستيراد القصيدة"}</span>
            </button>
          </div>

          {previewData.summary && (
            <div className="bg-paper-100/60 p-3 rounded-none border border-paper-400 text-xs text-ink-700 leading-relaxed">
              <span className="text-accent-700 font-bold block mb-1">ملخص القصيدة:</span>
              {previewData.summary}
            </div>
          )}

          {/* First 3 Verses Preview */}
          <div className="space-y-2 pt-2 border-t border-paper-400">
            <span className="text-xs font-semibold text-ink-600 block mb-1">معاينة أول 3 أبيات:</span>
            {previewData.verses.slice(0, 3).map((verseText, i) => {
              const { first, second } = provider.splitHemistichs(verseText);
              return (
                <div
                  key={i}
                  className="bg-paper-100/60 p-2.5 rounded-none border border-paper-400 text-xs font-heading text-ink-800 flex justify-between gap-4"
                >
                  <span className="flex-1 text-right">{first}</span>
                  <span className="text-accent-700/40">...</span>
                  <span className="flex-1 text-left">{second}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
