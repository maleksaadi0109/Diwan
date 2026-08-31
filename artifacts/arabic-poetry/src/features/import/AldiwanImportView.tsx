import React, { useState } from "react";
import { AldewanProvider } from "@/lib/providers/AldewanProvider";
import { ParsedPoemPayload } from "@/lib/providers/types";
import { Poem, WordDefinition } from "@/types";
import { Globe, Search, BookOpen, CheckCircle2, AlertCircle, RefreshCw, BookMarked } from "lucide-react";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";

interface AldiwanImportViewProps {
  onPoemImported: (poem: Poem, wordDefinitions?: WordDefinition[]) => void;
}

export const AldiwanImportView: React.FC<AldiwanImportViewProps> = ({ onPoemImported }) => {
  const [url, setUrl] = useState("");
  const [provider] = useState(() => new AldewanProvider());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ParsedPoemPayload | null>(null);
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
      const data = await provider.fetchByUrl(url.trim());
      setPreviewData(data);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "تعذر جلب بيانات القصيدة من aldiwan.net");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportPoem = () => {
    if (!previewData) return;

    setIsSaving(true);
    setError(null);

    try {
      const poemId = `poem-aldiwan-${Date.now()}`;

      const newPoem: Poem = {
        id: poemId,
        title: previewData.title,
        poet: {
          id: `poet-aldiwan-${normalizeArabic(previewData.poetName)}`,
          name: previewData.poetName,
          era: previewData.era,
        },
        era: previewData.era,
        bahr: previewData.bahr,
        rhyme: previewData.rhyme,
        description: previewData.description,
        versesCount: previewData.verses.length,
        externalProvider: "aldewan",
        sourceUrl: previewData.sourceUrl || url.trim(),
        tags: ["الديوان", `بحر ${previewData.bahr}`, `عصر ${previewData.era}`],
        verses: previewData.verses.map((v) => ({
          id: `v-aldiwan-${poemId}-${v.orderIndex}`,
          poemId,
          orderIndex: v.orderIndex,
          text: v.text,
          normalizedText: normalizeArabic(v.text),
          firstHemistich: v.firstHemistich,
          secondHemistich: v.secondHemistich,
        })),
        recordings: [],
      };

      const wordDefinitions: WordDefinition[] = (previewData.glossary || []).map((entry, i) => ({
        id: `word-aldiwan-${poemId}-${i}`,
        word: entry.word,
        normalizedWord: normalizeArabic(entry.word),
        meaning: entry.meaning,
        source: "aldiwan.net",
      }));

      onPoemImported(newPoem, wordDefinitions);
      setSuccessMessage(
        `تم استيراد قصيدة "${newPoem.title}" بنجاح (${newPoem.versesCount} بيت)` +
          (wordDefinitions.length > 0 ? ` مع ${wordDefinitions.length} من معاني الكلمات` : "")
      );
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "فشلت عملية حفظ القصيدة");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-charcoal-850 border border-white/5 rounded-2xl space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-accent-700/15 border border-accent-700/30 flex items-center justify-center text-accent-700">
          <Globe className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-parchment-100 font-heading">
            استيراد من الديوان (aldiwan.net)
          </h3>
          <p className="text-xs text-ink-600">
            جلب نص القصيدة والبحر والقافية، مع معاني الكلمات المساهم بها على الموقع
          </p>
        </div>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleFetchPreview} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.aldiwan.net/poem81.html"
          className="flex-1 bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-accent-700 ltr-num"
        />
        <button
          type="submit"
          disabled={!url.trim() || isLoading || isSaving}
          className="px-4 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-600 disabled:opacity-50 text-charcoal-950 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>جلب ومعاينة</span>
        </button>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-red-800/15 border border-crimson-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2 select-text">
          <AlertCircle className="w-4 h-4 shrink-0 text-crimson-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3.5 bg-green-700/15 border border-green-700/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2 select-text">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Preview Card */}
      {previewData && (
        <div className="p-5 bg-charcoal-900 rounded-2xl border border-white/5 space-y-4 animate-fadeIn select-text">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-heading text-lg font-bold text-parchment-100">
                {previewData.title}
              </h4>
              <p className="text-xs text-accent-700 font-medium mt-1 flex items-center gap-2">
                <span>{previewData.poetName}</span>
                <span>•</span>
                <span>العصر {previewData.era}</span>
                <span>•</span>
                <span>بحر {previewData.bahr}</span>
                <span>•</span>
                <span>{toArabicDigits(previewData.verses.length)} بيت</span>
              </p>
              {previewData.glossary && previewData.glossary.length > 0 && (
                <p className="text-xs text-ink-500 font-medium mt-1.5 flex items-center gap-1.5">
                  <BookMarked className="w-3.5 h-3.5 text-accent-700" />
                  <span>{toArabicDigits(previewData.glossary.length)} كلمة بمعانيها متاحة من الموقع</span>
                </p>
              )}
            </div>

            <button
              onClick={handleImportPoem}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-600 text-charcoal-950 font-bold text-xs transition-colors shadow-md flex items-center gap-1.5 shrink-0"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
              <span>{isSaving ? "جاري الاستيراد..." : "تأكيد واستيراد القصيدة"}</span>
            </button>
          </div>

          {/* First 3 Verses Preview */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <span className="text-xs font-semibold text-ink-600 block mb-1">
              معاينة أول 3 أبيات:
            </span>
            {previewData.verses.slice(0, 3).map((v, i) => (
              <div
                key={i}
                className="bg-charcoal-850/60 p-2.5 rounded-2xl border border-white/5 text-xs font-heading text-parchment-100 flex justify-between gap-4"
              >
                <span className="flex-1 text-right">{v.firstHemistich}</span>
                <span className="text-accent-700/40">...</span>
                <span className="flex-1 text-left">{v.secondHemistich}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
