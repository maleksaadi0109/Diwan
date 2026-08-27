import React, { useState } from "react";
import { MizanAlArabProvider, MizanPoemApiResponse } from "@/lib/providers/MizanAlArabProvider";
import { Poem } from "@/types";
import { Globe, Search, BookOpen, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { normalizeArabic, toArabicDigits } from "@/lib/utils";

interface MizanImportViewProps {
  onPoemImported: (poem: Poem) => void;
}

export const MizanImportView: React.FC<MizanImportViewProps> = ({ onPoemImported }) => {
  const [url, setUrl] = useState("");
  const [provider] = useState(() => new MizanAlArabProvider());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MizanPoemApiResponse | null>(null);

  // Enrichment state
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [enrichmentMessage, setEnrichmentMessage] = useState("");
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
      const poemId = provider.extractPoemIdFromUrl(url.trim());
      const data = await provider.fetchPoemById(poemId);
      setPreviewData(data);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "تعذر جلب بيانات القصيدة من ميزان العرب");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportPoem = async () => {
    if (!previewData) return;

    setIsSaving(true);
    setError(null);

    try {
      const parsed = provider.mapApiResponseToPayload(previewData);
      const poemId = `poem-mizan-${previewData.id}`;
      const poetId = `poet-mizan-${previewData.poet_id || previewData.poet?.id || Date.now()}`;

      const newPoem: Poem = {
        id: poemId,
        title: parsed.title,
        poet: {
          id: poetId,
          name: parsed.poetName,
          era: parsed.era,
          bio: previewData.poet?.bio,
          birthYear: previewData.poet?.birth_year,
          deathYear: previewData.poet?.death_year,
        },
        era: parsed.era,
        bahr: parsed.bahr,
        rhyme: parsed.rhyme,
        description: parsed.description,
        versesCount: parsed.verses.length,
        externalProvider: "mizan_al_arab",
        externalId: String(previewData.id),
        sourceUrl: parsed.sourceUrl,
        theme: previewData.theme,
        verified: previewData.verified,
        tags: ["ميزان العرب", `بحر ${parsed.bahr}`, `عصر ${parsed.era}`],
        verses: parsed.verses.map((v) => ({
          id: `v-mizan-${previewData.id}-${v.orderIndex}`,
          poemId,
          orderIndex: v.orderIndex,
          text: v.text,
          normalizedText: normalizeArabic(v.text),
          firstHemistich: v.firstHemistich,
          secondHemistich: v.secondHemistich,
          externalId: String(previewData.verses[v.orderIndex - 1]?.id || ""),
        })),
        recordings: [],
      };

      // Save immediately so the user can open the poem while enrichment runs.
      onPoemImported(newPoem);
      setSuccessMessage(`تم استيراد قصيدة "${newPoem.title}" بنجاح (${newPoem.versesCount} بيت)`);

      // Enrich explanations in the background, then persist the enriched version
      // through the parent repository. This also works with the browser memory adapter.
      setIsEnriching(true);
      setEnrichmentMessage("جاري تحميل الشروح الكلاسيكية والمعاني للأبيات...");

      try {
        const explanationsMap = await provider.enrichVersesWithExplanations(
          previewData.verses,
          (completed, total, msg) => {
            setEnrichmentProgress(completed / total);
            setEnrichmentMessage(msg);
          }
        );

        const enrichedPoem: Poem = {
          ...newPoem,
          verses: newPoem.verses.map((verse) => ({
            ...verse,
            explanations: explanationsMap.get(verse.externalId || "") || undefined,
          })),
        };
        onPoemImported(enrichedPoem);
      } catch (err_exp) {
        console.warn("Non-fatal error fetching background explanations:", err_exp);
      } finally {
        setIsEnriching(false);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "فشلت عملية حفظ القصيدة");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-charcoal-900 border border-charcoal-800 rounded-2xl space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
          <Globe className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-parchment-100 font-poetry">
            استيراد من ميزان العرب (Mizan Al-Arab)
          </h3>
          <p className="text-xs text-parchment-400">
            جلب النصوص المحققة والبحور والقوافي والشروح التراثية التبيانية
          </p>
        </div>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleFetchPreview} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://mizanalarab.com/poem/12345"
          className="flex-1 bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-500 ltr-num"
        />
        <button
          type="submit"
          disabled={!url.trim() || isLoading || isSaving}
          className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-charcoal-950 font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0"
        >
          {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>جلب ومعاينة</span>
        </button>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2 select-text">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 select-text">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Preview Card */}
      {previewData && (
        <div className="p-5 bg-charcoal-950 rounded-xl border border-charcoal-800 space-y-4 animate-fadeIn select-text">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-poetry text-lg font-bold text-parchment-100">
                {previewData.title}
              </h4>
              <p className="text-xs text-gold-400 font-medium mt-1 flex items-center gap-2">
                <span>{previewData.poet_name || previewData.poet?.name || "شاعر مجهول"}</span>
                <span>•</span>
                <span>العصر {provider.mapEra(previewData.poet?.era || previewData.era)}</span>
                <span>•</span>
                <span>بحر {provider.mapBahr(previewData.meter_name || previewData.bahr)}</span>
                <span>•</span>
                <span>{toArabicDigits(previewData.verses.length)} بيت</span>
              </p>
            </div>

            <button
              onClick={handleImportPoem}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-charcoal-950 font-bold text-xs transition-colors shadow-md flex items-center gap-1.5"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
              <span>{isSaving ? "جاري الاستيراد..." : "تأكيد واستيراد القصيدة"}</span>
            </button>
          </div>

          {/* First 3 Verses Preview */}
          <div className="space-y-2 pt-2 border-t border-charcoal-850">
            <span className="text-xs font-semibold text-parchment-400 block mb-1">
              معاينة أول 3 أبيات:
            </span>
            {previewData.verses.slice(0, 3).map((v, i) => {
              const { first, second } = provider.splitHemistichs(v.text);
              return (
                <div
                  key={v.id || i}
                  className="bg-charcoal-900/60 p-2.5 rounded-lg border border-charcoal-850 text-xs font-poetry text-parchment-200 flex justify-between gap-4"
                >
                  <span className="flex-1 text-right">{first}</span>
                  <span className="text-gold-500/40">...</span>
                  <span className="flex-1 text-left">{second}</span>
                </div>
              );
            })}
          </div>

          {/* Background Enrichment Progress */}
          {isEnriching && (
            <div className="p-3 bg-charcoal-900 rounded-lg border border-charcoal-800 space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gold-300 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-gold-400" />
                  <span>{enrichmentMessage}</span>
                </span>
                <span className="text-gold-400 font-mono ltr-num">{Math.round(enrichmentProgress * 100)}%</span>
              </div>
              <div className="w-full bg-charcoal-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gold-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, enrichmentProgress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
