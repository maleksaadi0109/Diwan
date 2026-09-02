import React, { useMemo, useState } from "react";
import { Poem } from "@/types";
import { POEM_CATALOG, CatalogPoemEntry } from "@/data/poemCatalog";
import { MizanAlArabProvider } from "@/lib/providers/MizanAlArabProvider";
import { PoemImportJobPayload, useImportQueueContext } from "@/contexts/ImportQueueContext";
import { Library, Feather, Download, Loader2, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

interface CatalogViewProps {
  poems: Poem[];
}

const provider = new MizanAlArabProvider();

/** Local state for one catalog card's own fetch/enqueue lifecycle, kept
 * separate from the shared import queue's per-job progress until a job id
 * exists to look up. */
type CardPhase =
  | { kind: "idle" }
  | { kind: "fetching_text" }
  | { kind: "queued"; jobId: string }
  | { kind: "error"; message: string };

export const CatalogView: React.FC<CatalogViewProps> = ({ poems }) => {
  const { enqueuePoemImport, jobs } = useImportQueueContext();
  const [cardPhases, setCardPhases] = useState<Record<string, CardPhase>>({});

  // A catalog entry counts as already in the library once a poem with the
  // matching Mizan external id has been saved -- this is how the same
  // pipeline records mizan-sourced poems (see processPoemImportJob).
  const importedMizanIds = useMemo(() => {
    return new Set(
      poems
        .filter((p) => p.externalProvider === "mizan_al_arab" && p.externalId)
        .map((p) => p.externalId as string)
    );
  }, [poems]);

  const handleDownload = async (entry: CatalogPoemEntry) => {
    setCardPhases((prev) => ({ ...prev, [entry.id]: { kind: "fetching_text" } }));
    try {
      const apiResponse = await provider.fetchPoemById(entry.mizanPoemId);
      const parsed = provider.mapApiResponseToPayload(apiResponse);

      const payload: PoemImportJobPayload = {
        title: parsed.title,
        poetName: parsed.poetName,
        era: parsed.era,
        bahr: parsed.bahr,
        rhyme: parsed.rhyme,
        parsedVerses: parsed.verses,
        audioSourceMode: "youtube",
        youtubeUrl: entry.youtubeUrl,
        importedFromMizan: true,
        mizanPoemId: entry.mizanPoemId,
        mizanUrl: entry.mizanUrl,
      };

      const jobId = enqueuePoemImport({ title: parsed.title, payload });
      setCardPhases((prev) => ({ ...prev, [entry.id]: { kind: "queued", jobId } }));
    } catch (err) {
      setCardPhases((prev) => ({
        ...prev,
        [entry.id]: {
          kind: "error",
          message: (err as Error)?.message || "تعذر جلب نص القصيدة من ميزان العرب",
        },
      }));
    }
  };

  const availableEntries = POEM_CATALOG.filter((entry) => !importedMizanIds.has(entry.mizanPoemId));

  return (
    <div className="h-full flex flex-col overflow-y-auto px-4 md:px-14 py-8 md:py-10 max-w-7xl mx-auto w-full scroll-smooth select-none pb-24 md:pb-28">
      <div className="mb-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-accent-700 flex items-center gap-1.5 font-sans bg-accent-700/10 px-3 py-1 rounded-full border border-accent-700/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>نصوص من ميزان العرب وإلقاء صوتي من استوديو القمة</span>
          </span>
        </div>
        <h2 className="text-4xl md:text-5xl font-poetry font-bold text-parchment-100 tracking-wide flex items-center gap-3">
          <span>مكتبة جاهزة</span>
          <Library className="w-6 h-6 text-accent-700" />
        </h2>
        <p className="text-sm text-ink-500 font-sans max-w-lg">
          اختر قصيدة لتنزيلها تلقائيًا إلى ديوانك: يجلب التطبيق نصها ويحمّل تسجيلها الصوتي ويحاذي الأبيات، دون الحاجة لتعبئة معالج الاستيراد يدويًا.
        </p>
      </div>

      {availableEntries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 animate-fade-in">
          {availableEntries.map((entry) => {
            const phase = cardPhases[entry.id] ?? { kind: "idle" as const };
            const job = phase.kind === "queued" ? jobs.find((j) => j.id === phase.jobId) : undefined;
            const isBusy = phase.kind === "fetching_text" || (phase.kind === "queued" && job && job.status !== "failed" && job.status !== "cancelled");
            const failed = (phase.kind === "queued" && job?.status === "failed") || phase.kind === "error";

            return (
              <div
                key={entry.id}
                className="group bg-charcoal-850 border border-white/5 hover:border-accent-700/30 rounded-3xl transition-all duration-300 shadow-md hover:shadow-xl flex flex-col p-5 md:p-6"
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="text-[10px] md:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/5 text-ink-600 border border-white/10">
                    لم تُنزَّل بعد
                  </span>
                </div>

                <h3 className="font-poetry text-xl md:text-2xl font-bold text-parchment-100 mb-2 line-clamp-2 leading-normal">
                  {entry.titleHint}
                </h3>
                <p className="text-xs font-medium text-ink-500 mb-6 flex items-center gap-1.5 font-sans">
                  <Feather className="w-3.5 h-3.5 text-accent-700" />
                  <span>{entry.poetHint}</span>
                </p>

                <div className="mt-auto pt-4 border-t border-white/5">
                  {failed && (
                    <p className="flex items-start gap-1.5 text-[11px] text-crimson-400 font-sans mb-3 leading-relaxed">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{phase.kind === "error" ? phase.message : job?.errorMessage || "فشل التنزيل"}</span>
                    </p>
                  )}

                  {phase.kind === "queued" && job && job.status !== "failed" && job.status !== "cancelled" && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[11px] text-ink-500 font-sans mb-1.5">
                        <span>{job.stageLabel}</span>
                        <span className="font-mono">{Math.round(job.progress * 100)}٪</span>
                      </div>
                      <div className="w-full h-1.5 bg-charcoal-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-700 transition-all duration-300"
                          style={{ width: `${Math.round(job.progress * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownload(entry)}
                    disabled={!!isBusy}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold font-sans text-xs transition-all cursor-pointer disabled:cursor-default bg-accent-700 hover:bg-accent-600 disabled:bg-white/5 text-charcoal-950 disabled:text-ink-500 focus-visible:ring-2 focus-visible:ring-accent-700"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{phase.kind === "fetching_text" ? "جارٍ جلب النص..." : "جارٍ التنزيل..."}</span>
                      </>
                    ) : failed ? (
                      <>
                        <Download className="w-4 h-4" />
                        <span>إعادة المحاولة</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>تنزيل إلى الديوان</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 md:p-20 bg-charcoal-850/40 border border-white/5 rounded-3xl animate-fade-in my-auto">
          <div className="w-20 h-20 bg-charcoal-800 border border-white/5 flex items-center justify-center mb-6 text-accent-700 rounded-3xl shadow-inner">
            <CheckCircle2 className="w-10 h-10" strokeWidth={1.5} />
          </div>
          <h3 className="text-3xl font-poetry font-bold text-parchment-100 mb-3">
            تم تنزيل كل قصائد المكتبة الجاهزة
          </h3>
          <p className="text-sm md:text-base text-ink-500 max-w-lg leading-relaxed font-sans">
            جميع القصائد المقترحة موجودة الآن في ديوانك.
          </p>
        </div>
      )}
    </div>
  );
};
