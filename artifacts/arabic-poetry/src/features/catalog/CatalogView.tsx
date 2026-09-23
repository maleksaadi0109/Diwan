import React, { useMemo, useState } from "react";
import { Poem } from "@/types";
import {
  POEM_CATALOG,
  CatalogPoemEntry,
  CATALOG_RECITERS,
  CatalogReciter,
  getReciterForEntry,
} from "@/data/poemCatalog";
import { MizanAlArabProvider } from "@/lib/providers/MizanAlArabProvider";
import type { ParsedVersePayload } from "@/lib/providers/types";
import { TARANEEM_POEMS } from "@/data/taraneemData";
import { PoemImportJobPayload, useImportQueueContext } from "@/contexts/ImportQueueContext";
import {
  Library,
  Feather,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  X,
  Users,
  LayoutGrid,
  ExternalLink,
  Mic,
} from "lucide-react";

interface CatalogViewProps {
  poems: Poem[];
}

const provider = new MizanAlArabProvider();

type CardPhase =
  | { kind: "idle" }
  | { kind: "fetching_text" }
  | { kind: "queued"; jobId: string }
  | { kind: "error"; message: string };

/** Reusable Reciter Avatar with graceful fallback on image load error */
const ReciterAvatar: React.FC<{
  reciter: CatalogReciter;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}> = ({ reciter, size = "md", className = "" }) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-11 h-11 text-xs",
    lg: "w-16 h-16 text-sm",
    xl: "w-20 h-20 text-base",
  }[size];

  if (hasError || !reciter.avatarUrl) {
    return (
      <div
        className={`${sizeClasses} rounded-2xl bg-gradient-to-br from-accent-700/20 to-charcoal-800 border border-accent-700/30 flex items-center justify-center font-bold text-accent-500 shrink-0 ${className}`}
        title={reciter.name}
      >
        <Mic className="w-1/2 h-1/2 text-accent-600" />
      </div>
    );
  }

  return (
    <img
      src={reciter.avatarUrl}
      alt={reciter.name}
      onError={() => setHasError(true)}
      className={`${sizeClasses} rounded-2xl object-cover border border-white/10 ring-2 ring-accent-700/20 shrink-0 ${className}`}
    />
  );
};

interface CatalogPoemCardProps {
  entry: CatalogPoemEntry;
  reciter: CatalogReciter;
  phase: CardPhase;
  job: any;
  onDownload: (entry: CatalogPoemEntry) => void;
  onSelectReciter?: (reciterId: string) => void;
}

const CatalogPoemCard: React.FC<CatalogPoemCardProps> = ({
  entry,
  reciter,
  phase,
  job,
  onDownload,
  onSelectReciter,
}) => {
  const isBusy =
    phase.kind === "fetching_text" ||
    (phase.kind === "queued" && job && job.status !== "failed" && job.status !== "cancelled");
  const failed = (phase.kind === "queued" && job?.status === "failed") || phase.kind === "error";

  return (
    <div className="group bg-charcoal-850 border border-white/5 hover:border-accent-700/30 rounded-3xl transition-all duration-300 shadow-md hover:shadow-xl flex flex-col p-5 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] md:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/5 text-ink-600 border border-white/10">
          لم تُنزَّل بعد
        </span>

        {/* Reciter badge chip */}
        <button
          type="button"
          onClick={() => onSelectReciter?.(reciter.id)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal-800 hover:bg-charcoal-750 border border-white/10 text-ink-400 hover:text-accent-500 transition-colors text-[11px] font-sans cursor-pointer"
          title={`تصفية بقصائد ${reciter.name}`}
        >
          <ReciterAvatar reciter={reciter} size="sm" className="!w-4 !h-4 !rounded-full !ring-0" />
          <span className="truncate max-w-[120px]">{reciter.name}</span>
        </button>
      </div>

      <h3 className="font-poetry text-xl md:text-2xl font-bold text-parchment-100 mb-2 line-clamp-2 leading-normal">
        {entry.titleHint}
      </h3>

      <div className="flex items-center justify-between gap-2 mb-5">
        <p className="text-xs font-medium text-ink-500 flex items-center gap-1.5 font-sans">
          <Feather className="w-3.5 h-3.5 text-accent-700" />
          <span>{entry.poetHint}</span>
        </p>
      </div>

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
          onClick={() => onDownload(entry)}
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
};

export const CatalogView: React.FC<CatalogViewProps> = ({ poems }) => {
  const { enqueuePoemImport, jobs } = useImportQueueContext();
  const [cardPhases, setCardPhases] = useState<Record<string, CardPhase>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReciterId, setSelectedReciterId] = useState<string | "all">("all");
  const [viewMode, setViewMode] = useState<"by_reciter" | "grid">("by_reciter");

  const importedMizanIds = useMemo(() => {
    return new Set(
      poems
        .filter((p) => p.externalProvider === "mizan_al_arab" && p.externalId)
        .map((p) => p.externalId as string)
    );
  }, [poems]);

  const handleDownload = async (entry: CatalogPoemEntry) => {
    const reciter = getReciterForEntry(entry);
    setCardPhases((prev) => ({ ...prev, [entry.id]: { kind: "fetching_text" } }));
    try {
      let parsedVerses: ParsedVersePayload[] = [];
      let poemTitle = entry.titleHint;
      let poetName = entry.poetHint;
      let era: any = "عباسي";
      let bahr: any = "البسيط";
      let rhyme = "";

      const preParsed = TARANEEM_POEMS.find(
        (p) => p.sourceUrl === entry.youtubeUrl || p.id === entry.id.replace("catalog-", "")
      );

      if (preParsed) {
        poemTitle = preParsed.title;
        poetName = preParsed.poet.name;
        era = preParsed.era;
        bahr = preParsed.bahr;
        rhyme = preParsed.rhyme;
        parsedVerses = preParsed.verses.map((v) => ({
          orderIndex: v.orderIndex,
          firstHemistich: v.firstHemistich,
          secondHemistich: v.secondHemistich,
          text: v.text,
        }));
      } else {
        const apiResponse = await provider.fetchPoemById(entry.mizanPoemId);
        const parsed = provider.mapApiResponseToPayload(apiResponse);
        poemTitle = parsed.title;
        poetName = parsed.poetName;
        era = parsed.era;
        bahr = parsed.bahr;
        rhyme = parsed.rhyme;
        parsedVerses = parsed.verses;
      }

      const payload: PoemImportJobPayload = {
        title: poemTitle,
        poetName: poetName,
        era: era,
        bahr: bahr,
        rhyme: rhyme,
        parsedVerses: parsedVerses,
        audioSourceMode: "youtube",
        youtubeUrl: entry.youtubeUrl,
        importedFromMizan: true,
        mizanPoemId: entry.mizanPoemId,
        mizanUrl: entry.mizanUrl,
        reciterName: reciter.name,
      };

      const jobId = enqueuePoemImport({ title: poemTitle, payload });
      setCardPhases((prev) => ({ ...prev, [entry.id]: { kind: "queued", jobId } }));
    } catch (err) {
      setCardPhases((prev) => ({
        ...prev,
        [entry.id]: {
          kind: "error",
          message: (err as Error)?.message || "تعذر جلب نص القصيدة",
        },
      }));
    }
  };

  const availableEntries = useMemo(() => {
    return POEM_CATALOG.filter((entry) => !importedMizanIds.has(entry.mizanPoemId));
  }, [importedMizanIds]);

  const reciterStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of availableEntries) {
      counts[entry.reciterId] = (counts[entry.reciterId] || 0) + 1;
    }
    const order = ["osama-alwaaedh", "taraneem", "omar-alsharafi", "khaled-alsharafi", "khaled-bin-hassan"];
    return order
      .map((id) => ({
        reciter: CATALOG_RECITERS[id],
        count: counts[id] || 0,
      }))
      .filter((item) => item.reciter !== undefined);
  }, [availableEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableEntries.filter((entry) => {
      if (selectedReciterId !== "all" && entry.reciterId !== selectedReciterId) {
        return false;
      }
      if (q) {
        const reciter = getReciterForEntry(entry);
        const matchesTitle = entry.titleHint.toLowerCase().includes(q);
        const matchesPoet = entry.poetHint.toLowerCase().includes(q);
        const matchesReciter = reciter.name.toLowerCase().includes(q);
        return matchesTitle || matchesPoet || matchesReciter;
      }
      return true;
    });
  }, [availableEntries, searchQuery, selectedReciterId]);

  const reciterGroups = useMemo(() => {
    const order = ["osama-alwaaedh", "taraneem", "omar-alsharafi", "khaled-alsharafi", "khaled-bin-hassan"];
    const groups: { reciter: CatalogReciter; entries: CatalogPoemEntry[] }[] = [];

    for (const id of order) {
      if (selectedReciterId !== "all" && selectedReciterId !== id) {
        continue;
      }
      const reciter = CATALOG_RECITERS[id];
      if (!reciter) continue;

      const entries = filteredEntries.filter((e) => e.reciterId === id);
      if (entries.length > 0) {
        groups.push({ reciter, entries });
      }
    }
    return groups;
  }, [filteredEntries, selectedReciterId]);

  return (
    <div className="h-full flex flex-col overflow-y-auto px-4 md:px-14 py-8 md:py-10 max-w-7xl mx-auto w-full scroll-smooth select-none pb-24 md:pb-28">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-accent-700 flex items-center gap-1.5 font-sans bg-accent-700/10 px-3 py-1 rounded-full border border-accent-700/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>نصوص موثقة من ميزان العرب وإلقاء صوتي لنخبة من قرّاء الشعر العربي</span>
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-4xl md:text-5xl font-poetry font-bold text-parchment-100 tracking-wide flex items-center gap-3">
            <span>المكتبة الجاهزة</span>
            <Library className="w-6 h-6 text-accent-700" />
          </h2>

          {availableEntries.length > 0 && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 text-ink-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في القصائد، الشعراء، أو القرّاء..."
                  className="w-full pl-9 pr-10 py-2.5 bg-charcoal-850 border border-white/10 rounded-xl text-sm text-parchment-100 placeholder-ink-600 focus:outline-none focus:border-accent-700/60 font-sans transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-parchment-100 p-1 cursor-pointer"
                    title="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center bg-charcoal-850 border border-white/10 rounded-xl p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("by_reciter")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                    viewMode === "by_reciter"
                      ? "bg-accent-700 text-charcoal-950 shadow-sm"
                      : "text-ink-500 hover:text-parchment-100"
                  }`}
                  title="عرض مرتب حسب القارئ"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">حسب القارئ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-accent-700 text-charcoal-950 shadow-sm"
                      : "text-ink-500 hover:text-parchment-100"
                  }`}
                  title="عرض شبكة موحدة"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">شبكة شاملة</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-ink-500 font-sans max-w-2xl">
          تصفح القصائد حسب القارئ مع إمكانية تنزيل أي قصيدة بنصها المحقق وتسجيلها الصوتي فورًا إلى ديوانك مع محاذاة صوتية تلقائية في الخلفية.
        </p>
      </div>

      {availableEntries.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-accent-700" />
            <span className="text-xs font-bold text-parchment-200 font-sans">
              تصفح حسب القارئ ({reciterStats.length} قرّاء معتمدون)
            </span>
            {selectedReciterId !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedReciterId("all")}
                className="text-[11px] text-accent-500 hover:underline mr-auto cursor-pointer"
              >
                إظهار جميع القرّاء
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedReciterId("all")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all cursor-pointer shrink-0 font-sans text-xs ${
                selectedReciterId === "all"
                  ? "bg-accent-700/15 border-accent-700/60 text-accent-500 font-bold shadow-md ring-1 ring-accent-700/30"
                  : "bg-charcoal-850 hover:bg-charcoal-800 border-white/5 text-ink-400"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-charcoal-800 border border-white/10 flex items-center justify-center font-bold text-accent-500">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-right">
                <span className="block font-medium">كل القرّاء</span>
                <span className="text-[10px] text-ink-600 block">{availableEntries.length} قصيدة</span>
              </div>
            </button>

            {reciterStats.map(({ reciter, count }) => {
              const isSelected = selectedReciterId === reciter.id;
              return (
                <button
                  key={reciter.id}
                  type="button"
                  onClick={() => setSelectedReciterId(isSelected ? "all" : reciter.id)}
                  className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl border transition-all cursor-pointer shrink-0 font-sans ${
                    isSelected
                      ? "bg-accent-700/15 border-accent-700/60 text-accent-500 font-bold shadow-md ring-1 ring-accent-700/30"
                      : "bg-charcoal-850 hover:bg-charcoal-800 border-white/5 text-ink-400 hover:text-parchment-100"
                  }`}
                >
                  <ReciterAvatar
                    reciter={reciter}
                    size="md"
                    className={isSelected ? "!ring-accent-700 !ring-2" : ""}
                  />
                  <div className="text-right">
                    <span className="block text-xs font-medium leading-snug">{reciter.name}</span>
                    <span className="text-[10px] text-ink-600 block">{count} قصيدة متاحة</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {availableEntries.length > 0 ? (
        filteredEntries.length > 0 ? (
          viewMode === "by_reciter" ? (
            <div className="flex flex-col gap-10 animate-fade-in">
              {reciterGroups.map(({ reciter, entries }) => (
                <section
                  key={reciter.id}
                  className="flex flex-col gap-4 p-6 bg-charcoal-900/60 border border-white/5 rounded-3xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <ReciterAvatar reciter={reciter} size="lg" />
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-poetry text-2xl md:text-3xl font-bold text-parchment-100">
                            {reciter.name}
                          </h3>
                          <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-accent-700/15 text-accent-500 border border-accent-700/30">
                            {reciter.role}
                          </span>
                        </div>
                        <p className="text-xs text-ink-500 font-sans mt-1 max-w-xl">
                          {reciter.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-center">
                      <span className="text-xs font-bold font-sans text-ink-500 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                        {entries.length} قصيدة
                      </span>
                      {reciter.channelUrl && (
                        <a
                          href={reciter.channelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-500 bg-accent-700/10 hover:bg-accent-700/20 px-3 py-1.5 rounded-xl border border-accent-700/20 transition-colors font-sans"
                          title="زيارة قناة اليوتيوب"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">القناة</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 pt-2">
                    {entries.map((entry) => {
                      const phase = cardPhases[entry.id] ?? { kind: "idle" as const };
                      const job = phase.kind === "queued" ? jobs.find((j) => j.id === phase.jobId) : undefined;
                      return (
                        <CatalogPoemCard
                          key={entry.id}
                          entry={entry}
                          reciter={reciter}
                          phase={phase}
                          job={job}
                          onDownload={handleDownload}
                          onSelectReciter={setSelectedReciterId}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 animate-fade-in">
              {filteredEntries.map((entry) => {
                const reciter = getReciterForEntry(entry);
                const phase = cardPhases[entry.id] ?? { kind: "idle" as const };
                const job = phase.kind === "queued" ? jobs.find((j) => j.id === phase.jobId) : undefined;
                return (
                  <CatalogPoemCard
                    key={entry.id}
                    entry={entry}
                    reciter={reciter}
                    phase={phase}
                    job={job}
                    onDownload={handleDownload}
                    onSelectReciter={setSelectedReciterId}
                  />
                );
              })}
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-charcoal-850/40 border border-white/5 rounded-3xl animate-fade-in my-12">
            <Search className="w-10 h-10 text-ink-600 mb-3" />
            <h3 className="text-xl font-poetry font-bold text-parchment-100 mb-2">
              لا توجد قصائد مطابقة لبحثك
            </h3>
            <p className="text-xs text-ink-500 font-sans mb-4">
              لم نعثر على قصائد تطابق خيارات البحث الحالية. جرب البحث بكلمة أخرى أو تغيير القارئ المحدد.
            </p>
            <div className="flex items-center gap-2">
              {selectedReciterId !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedReciterId("all")}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-accent-500 transition-colors cursor-pointer"
                >
                  إظهار كل القرّاء
                </button>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-parchment-200 transition-colors cursor-pointer"
                >
                  مسح نص البحث
                </button>
              )}
            </div>
          </div>
        )
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
