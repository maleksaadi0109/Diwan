import React, { useEffect, useState } from "react";
import { Poem, Era, Bahr } from "@/types";
import { MizanAlArabProvider } from "@/lib/providers/MizanAlArabProvider";
import type { ParsedPoemPayload, ParsedVersePayload } from "@/lib/providers/types";
import {
  fetchYoutubeVideoInfo,
  downloadYoutubeThumbnail,
  WorkerYouTubeInfoData,
} from "@/lib/worker/workerClient";
import { pickAudioFile, resolveAudioSrc } from "@/lib/audio/fileManager";
import { DiwanRepository } from "@/lib/db/repository";
import { formatTime, toArabicDigits } from "@/lib/utils";
import { useImportQueueContext, PoemImportJobPayload, PoemImportJobResult } from "@/contexts/ImportQueueContext";
import {
  BookOpen,
  Music,
  Eye,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
  Upload,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";

interface NewPoemWizardProps {
  onFinishWizard: (poem: Poem) => void;
}

const ERROR_MAP: Record<string, string> = {
  YTDLP_NOT_INSTALLED: "مكوّن تنزيل YouTube غير مثبت.",
  FFMPEG_NOT_FOUND: "برنامج FFmpeg غير متوفر أو لم يتم العثور على مساره.",
  VIDEO_UNAVAILABLE: "المقطع غير متاح أو تم حذفه.",
  PRIVATE_VIDEO: "المقطع خاص ولا يمكن تنزيله.",
  LOGIN_REQUIRED: "يتطلب هذا المقطع تسجيل الدخول. أدخل بيانات تسجيل الدخول (كوكيز) من متصفحك أدناه للمتابعة.",
  COOKIES_INVALID: "بيانات تسجيل الدخول (الكوكيز) غير صالحة أو منتهية الصلاحية. يرجى الحصول على كوكيز جديدة والمحاولة مجددًا.",
  LIVE_STREAM_NOT_SUPPORTED: "تنزيل البث المباشر غير مدعوم.",
  NO_AUDIO_FORMAT: "لم يتم العثور على مسار صوتي مناسب.",
  DOWNLOAD_FAILED: "فشل تنزيل الصوت. افتح تفاصيل الخطأ للمزيد.",
  CONVERSION_FAILED: "تم تنزيل الملف، لكن تحويله إلى MP3 فشل.",
  OUTPUT_MISSING: "انتهت عملية التنزيل دون إنشاء ملف صوتي.",
  NETWORK_TIMEOUT: "انتهت مهلة الاتصال أثناء تنزيل الصوت.",
  FILESYSTEM_ERROR: "تعذر حفظ الصوت في مجلد التطبيق.",
};

const COOKIE_UNLOCK_CODES = new Set(["LOGIN_REQUIRED", "COOKIES_INVALID"]);

/** Reads the leading `CODE: message` prefix that workerClient attaches to
 * YouTube worker errors, falling back to substring scanning. */
function extractErrorCode(err: unknown): string | null {
  const msg = (err as Error)?.message || String(err || "");
  const prefixMatch = msg.match(/^([A-Z_]+):/);
  if (prefixMatch && prefixMatch[1] in ERROR_MAP) {
    return prefixMatch[1];
  }
  for (const code of Object.keys(ERROR_MAP)) {
    if (msg.includes(code)) return code;
  }
  return null;
}

function formatErrorMessage(err: unknown): string {
  if (!err) return "فشلت عملية المعالجة";
  const msg = (err as Error).message || String(err);
  const code = extractErrorCode(err);
  if (code) return ERROR_MAP[code];
  return msg.replace(/^[A-Z_]+:\s*/, "");
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STAGE_DESCRIPTIONS: Record<string, string> = {
  queued: "بانتظار دورها في طابور المعالجة",
  download: "جلب الصوت بأعلى دقة",
  convert: "تحويل إلى 16kHz mono WAV",
  vad: "تحليل VAD وحساب فترات التوقف",
  asr: "استخراج الكلمات والطوابع الزمنية",
  align: "مطابقة النص مع الصوت",
  saving: "حفظ القصيدة في الديوان",
  done: "انتهت جميع المراحل",
};

export const NewPoemWizard: React.FC<NewPoemWizardProps> = ({ onFinishWizard }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const { enqueuePoemImport, jobs, retryJob, cancelJob } = useImportQueueContext();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeJob = activeJobId ? jobs.find((j) => j.id === activeJobId) || null : null;

  // Step 1: Poem Data
  const [poemSourceMode, setPoemSourceMode] = useState<"mizan" | "manual" | "json">("mizan");
  const [mizanUrl, setMizanUrl] = useState("");
  const [mizanLoading, setMizanLoading] = useState(false);
  const [mizanError, setMizanError] = useState<string | null>(null);
  const [mizanPayload, setMizanPayload] = useState<ParsedPoemPayload | null>(null);
  const [mizanSourceText, setMizanSourceText] = useState("");
  const [mizanPoemId, setMizanPoemId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [poetName, setPoetName] = useState("");
  const [era, setEra] = useState<Era>("عباسي");
  const [bahr, setBahr] = useState<Bahr>("البسيط");
  const [rhyme, setRhyme] = useState("");
  const [versesRaw, setVersesRaw] = useState("");

  // Step 2: Audio Data
  const [audioSourceMode, setAudioSourceMode] = useState<"youtube" | "local" | "skip">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeInfo, setYoutubeInfo] = useState<WorkerYouTubeInfoData | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeCoverImage, setYoutubeCoverImage] = useState<string | null>(null);
  const [youtubeNeedsCookies, setYoutubeNeedsCookies] = useState(false);
  const [youtubeCookiesText, setYoutubeCookiesText] = useState("");
  const [showYoutubeCookieHelp, setShowYoutubeCookieHelp] = useState(false);

  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null);
  const [localAudioName, setLocalAudioName] = useState<string | null>(null);

  const [generatedPoem, setGeneratedPoem] = useState<Poem | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Once the queued job completes, fetch the persisted Poem (the queue itself
  // saved it, possibly after this component was unmounted/remounted) to show
  // the review step.
  useEffect(() => {
    if (!activeJob || activeJob.status !== "completed" || !activeJob.resultJson) return;
    let cancelled = false;
    (async () => {
      try {
        const result: PoemImportJobResult = JSON.parse(activeJob.resultJson!);
        const repo = await DiwanRepository.create();
        const poem = await repo.getPoemById(result.poemId);
        if (!cancelled && poem) {
          setGeneratedPoem(poem);
          setCurrentStep(5);
        }
      } catch (err) {
        if (!cancelled) setReviewError((err as Error).message || "تعذر تحميل القصيدة بعد اكتمال المعالجة");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.status, activeJob?.resultJson]);

  // Parse raw verses
  const getParsedVerses = (): ParsedVersePayload[] => {
    if (poemSourceMode === "mizan" && mizanPayload && versesRaw === mizanSourceText) {
      return mizanPayload.verses;
    }

    const provider = new MizanAlArabProvider();
    const lines = versesRaw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.map((line, idx) => {
      const { first, second } = provider.splitHemistichs(line);
      return {
        orderIndex: idx + 1,
        text: line,
        firstHemistich: first,
        secondHemistich: second,
      };
    });
  };

  // Mizan Fetch Action
  const handleFetchMizan = async () => {
    if (!mizanUrl.trim()) return;
    setMizanLoading(true);
    setMizanError(null);
    try {
      const provider = new MizanAlArabProvider();
      const poemId = provider.extractPoemIdFromUrl(mizanUrl.trim());
      const data = await provider.fetchPoemById(poemId);
      const parsed = provider.mapApiResponseToPayload(data);
      const sourceText = parsed.verses
        .map((v) => `${v.firstHemistich} — ${v.secondHemistich}`)
        .join("\n");

      setTitle(parsed.title);
      setPoetName(parsed.poetName);
      setEra(parsed.era);
      setBahr(parsed.bahr);
      setRhyme(parsed.rhyme);
      setVersesRaw(sourceText);
      setMizanPayload(parsed);
      setMizanSourceText(sourceText);
      setMizanPoemId(String(data.id));
    } catch (err: unknown) {
      setMizanError((err as Error).message || "تعذر جلب القصيدة من ميزان العرب");
    } finally {
      setMizanLoading(false);
    }
  };

  // YouTube Fetch Action
  const handleFetchYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setYoutubeLoading(true);
    setYoutubeError(null);
    try {
      const info = await fetchYoutubeVideoInfo(
        youtubeUrl.trim(),
        3600,
        youtubeNeedsCookies ? youtubeCookiesText.trim() : undefined
      );
      setYoutubeInfo(info);
      setYoutubeCoverImage(null);
      setYoutubeNeedsCookies(false);
      if (info.thumbnail) {
        // Download the thumbnail server-side and store it as a data URL so
        // the cover image persists locally and works offline, instead of
        // relying on a live link to YouTube's CDN.
        downloadYoutubeThumbnail(info.thumbnail).then((dataUrl) => {
          setYoutubeCoverImage(dataUrl || info.thumbnail || null);
        });
      }
    } catch (err: unknown) {
      const code = extractErrorCode(err);
      if (code && COOKIE_UNLOCK_CODES.has(code)) {
        setYoutubeNeedsCookies(true);
      }
      setYoutubeError(formatErrorMessage(err));
    } finally {
      setYoutubeLoading(false);
    }
  };

  // Local file pick
  const handlePickLocal = async () => {
    const picked = await pickAudioFile();
    if (picked) {
      setLocalAudioPath(picked.path);
      setLocalAudioName(picked.name);
    }
  };

  // Enqueue the full pipeline as a background job instead of running it
  // inline: this lets the user close/navigate away from the wizard while it
  // processes, and the job survives even if this component unmounts.
  const handleStartProcessing = () => {
    const parsedVerses = getParsedVerses();
    const importedFromMizan =
      poemSourceMode === "mizan" && mizanPayload !== null && mizanPoemId !== null && versesRaw === mizanSourceText;

    const payload: PoemImportJobPayload = {
      title,
      poetName,
      era,
      bahr,
      rhyme,
      parsedVerses,
      audioSourceMode,
      youtubeUrl: audioSourceMode === "youtube" ? youtubeUrl : undefined,
      youtubeCookies: youtubeNeedsCookies ? youtubeCookiesText.trim() : undefined,
      youtubeInfo,
      youtubeCoverImage,
      localAudioPath: audioSourceMode === "local" ? localAudioPath || undefined : undefined,
      localAudioName: audioSourceMode === "local" ? localAudioName || undefined : undefined,
      importedFromMizan,
      mizanPoemId,
      mizanUrl: mizanUrl.trim(),
    };

    const jobId = enqueuePoemImport({ title: title.trim() || "قصيدة جديدة", payload });
    setActiveJobId(jobId);
    setGeneratedPoem(null);
    setReviewError(null);
    setCurrentStep(4);
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6 max-w-5xl mx-auto w-full select-none">
      {/* Wizard Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {[
            { step: 1, label: "1. نص القصيدة" },
            { step: 2, label: "2. التسجيل الصوتي" },
            { step: 3, label: "3. المعاينة والتأكيد" },
            { step: 4, label: "4. المعالجة الذكية" },
            { step: 5, label: "5. المراجعة والتشغيل" },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === s.step
                    ? "bg-accent-700 text-parchment-100 shadow-md shadow-accent-700/20"
                    : currentStep > s.step
                    ? "bg-emerald-600 text-parchment-100"
                    : "bg-charcoal-800 text-ink-600"
                }`}
              >
                {currentStep > s.step ? <CheckCircle2 className="w-4 h-4" /> : s.step}
              </div>
              <span
                className={`text-[11px] mt-1.5 font-medium ${
                  currentStep === s.step ? "text-accent-700" : "text-ink-600"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Poem Source */}
      {currentStep === 1 && (
        <div className="bg-charcoal-850 border border-white/5 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-accent-700" />
            <div>
              <h3 className="text-base font-bold text-parchment-100 font-heading">
                الخطوة الأولى: مصدر نص القصيدة وبياناتها
              </h3>
              <p className="text-xs text-ink-600">
                اختر استيراد القصيدة من ميزان العرب أو كتابتها ولصقها يدوياً
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-1 bg-charcoal-900 rounded-2xl border border-white/5">
            <button
              onClick={() => setPoemSourceMode("mizan")}
              className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                poemSourceMode === "mizan" ? "bg-accent-700 text-parchment-100" : "text-ink-600 hover:text-parchment-100"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ميزان العرب (Mizan Al-Arab)</span>
            </button>
            <button
              onClick={() => setPoemSourceMode("manual")}
              className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                poemSourceMode === "manual" ? "bg-accent-700 text-parchment-100" : "text-ink-600 hover:text-parchment-100"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>إدخال ولصق يدوي</span>
            </button>
          </div>

          {/* Mizan URL Input */}
          {poemSourceMode === "mizan" && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-ink-400">
                رابط القصيدة في موقع ميزان العرب:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={mizanUrl}
                  onChange={(e) => setMizanUrl(e.target.value)}
                  placeholder="https://mizanalarab.com/poem/12345"
                  className="flex-1 bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-accent-700 ltr-num"
                />
                <button
                  type="button"
                  onClick={handleFetchMizan}
                  disabled={!mizanUrl.trim() || mizanLoading}
                  className="px-4 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-700 disabled:opacity-50 text-parchment-100 font-bold text-xs"
                >
                  {mizanLoading ? "جاري الجلب..." : "جلب النص"}
                </button>
              </div>
              {mizanError && <p className="text-xs text-crimson-400">{mizanError}</p>}
            </div>
          )}

          {/* Poem Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-400 mb-1">عنوان القصيدة *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان القصيدة"
                className="w-full bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl px-4 py-2 text-xs focus:outline-none focus:border-accent-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-400 mb-1">اسم الشاعر *</label>
              <input
                type="text"
                value={poetName}
                onChange={(e) => setPoetName(e.target.value)}
                placeholder="اسم الشاعر"
                className="w-full bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl px-4 py-2 text-xs focus:outline-none focus:border-accent-700"
              />
            </div>
          </div>

          {/* Verses textarea */}
          <div>
            <label className="block text-xs font-semibold text-ink-400 mb-1">
              أبيات القصيدة (كل بيت في سطر مع فاصل " — " أو " - ") *
            </label>
            <textarea
              rows={6}
              value={versesRaw}
              onChange={(e) => setVersesRaw(e.target.value)}
              placeholder="واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ — وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ"
              className="w-full bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl p-3 text-xs font-heading leading-relaxed focus:outline-none focus:border-accent-700"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!title.trim() || !poetName.trim() || !versesRaw.trim()}
              className="px-6 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-700 disabled:opacity-50 text-parchment-100 font-bold text-xs flex items-center gap-1.5"
            >
              <span>المتابعة إلى اختيار الصوت</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Audio Source */}
      {currentStep === 2 && (
        <div className="bg-charcoal-850 border border-white/5 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-accent-700" />
            <div>
              <h3 className="text-base font-bold text-parchment-100 font-heading">
                الخطوة الثانية: اختيار التسجيل الصوتي
              </h3>
              <p className="text-xs text-ink-600">
                استيراد تسجيل بصوت ملقي القصيدة من YouTube أو ملف محلي
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-1 bg-charcoal-900 rounded-2xl border border-white/5">
            <button
              onClick={() => setAudioSourceMode("youtube")}
              className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                audioSourceMode === "youtube" ? "bg-accent-700 text-parchment-100" : "text-ink-600 hover:text-parchment-100"
              }`}
            >
              <YoutubeIcon className="w-3.5 h-3.5" />
              <span>رابط YouTube</span>
            </button>
            <button
              onClick={() => setAudioSourceMode("local")}
              className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                audioSourceMode === "local" ? "bg-accent-700 text-parchment-100" : "text-ink-600 hover:text-parchment-100"
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>ملف صوتي محلي</span>
            </button>
            <button
              onClick={() => setAudioSourceMode("skip")}
              className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                audioSourceMode === "skip" ? "bg-accent-700 text-parchment-100" : "text-ink-600 hover:text-parchment-100"
              }`}
            >
              <span>تخطي الصوت مؤقتاً</span>
            </button>
          </div>

          {/* YouTube Option */}
          {audioSourceMode === "youtube" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-accent-700 ltr-num"
                />
                <button
                  type="button"
                  onClick={handleFetchYoutube}
                  disabled={!youtubeUrl.trim() || youtubeLoading}
                  className="px-4 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-700 disabled:opacity-50 text-parchment-100 font-bold text-xs"
                >
                  {youtubeLoading ? "جاري الفحص..." : "فحص المقطع"}
                </button>
              </div>
              {youtubeError && <p className="text-xs text-crimson-400">{youtubeError}</p>}

              {youtubeNeedsCookies && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
                      <KeyRound className="w-4 h-4" />
                      <span>هذا المقطع يتطلب تسجيل الدخول</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowYoutubeCookieHelp((v) => !v)}
                      className="text-xs text-amber-300/80 hover:text-amber-200 underline underline-offset-2"
                    >
                      كيف أحصل على الكوكيز؟
                    </button>
                  </div>
                  {showYoutubeCookieHelp && (
                    <ol className="text-[11px] text-ink-500 leading-relaxed list-decimal list-inside space-y-1 bg-charcoal-950/60 p-3 rounded-xl border border-white/5">
                      <li>سجّل الدخول إلى حسابك في YouTube داخل متصفحك.</li>
                      <li>
                        استخدم إضافة متصفح مثل "Get cookies.txt LOCALLY" لتصدير كوكيز موقع youtube.com بصيغة Netscape.
                      </li>
                      <li>الصق محتوى الملف بالكامل في الحقل أدناه ثم أعد المحاولة.</li>
                    </ol>
                  )}
                  <textarea
                    value={youtubeCookiesText}
                    onChange={(e) => setYoutubeCookiesText(e.target.value)}
                    placeholder="# Netscape HTTP Cookie File&#10;.youtube.com  TRUE  /  TRUE  ...  "
                    dir="ltr"
                    rows={4}
                    className="w-full bg-charcoal-950/80 text-parchment-100 placeholder-ink-500/60 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-accent-700/60 resize-y"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] text-ink-500/80">تُستخدم الكوكيز محليًا لهذه العملية فقط ولا يتم تخزينها.</p>
                    <button
                      type="button"
                      onClick={handleFetchYoutube}
                      disabled={!youtubeCookiesText.trim() || youtubeLoading}
                      className="shrink-0 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-500/40 font-bold text-xs flex items-center gap-2"
                    >
                      {youtubeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                      <span>إعادة المحاولة بتسجيل الدخول</span>
                    </button>
                  </div>
                </div>
              )}

              {youtubeInfo && (
                <div className="p-3 bg-charcoal-900 rounded-2xl border border-white/5 flex gap-3 items-center">
                  {youtubeInfo.thumbnail && (
                    <img src={youtubeInfo.thumbnail} alt="" className="w-20 h-14 object-cover rounded-2xl" />
                  )}
                  <div className="text-xs">
                    <h5 className="font-bold text-parchment-100">{youtubeInfo.title}</h5>
                    <p className="text-ink-600">{youtubeInfo.channel} • {formatTime(youtubeInfo.duration_ms)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Local File Option */}
          {audioSourceMode === "local" && (
            <div className="p-6 bg-charcoal-900 rounded-2xl border border-dashed border-white/10 text-center">
              <button
                type="button"
                onClick={handlePickLocal}
                className="px-4 py-2 rounded-2xl bg-charcoal-800 hover:border-white/5 text-accent-700 text-xs font-semibold border border-white/10"
              >
                {localAudioName ? `تم اختيار: ${localAudioName}` : "اختيار ملف صوتي محلي..."}
              </button>
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-2xl bg-charcoal-800 text-ink-400 text-xs flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>السابق</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-700 text-parchment-100 font-bold text-xs flex items-center gap-1.5"
            >
              <span>المتابعة إلى المعاينة</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Confirm */}
      {currentStep === 3 && (
        <div className="bg-charcoal-850 border border-white/5 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-accent-700" />
            <div>
              <h3 className="text-base font-bold text-parchment-100 font-heading">
                الخطوة الثالثة: المعاينة والتأكيد
              </h3>
              <p className="text-xs text-ink-600">
                تأكد من صحة البيانات قبل بدء المعالجة الآلية والمحاذاة
              </p>
            </div>
          </div>

          {/* Overview summary */}
          <div className="p-4 bg-charcoal-900 rounded-2xl border border-white/5 space-y-2">
            <h4 className="font-heading text-lg font-bold text-accent-700">{title}</h4>
            <p className="text-xs text-ink-400 flex items-center gap-2">
              <span>الشاعر: {poetName}</span>
              <span>•</span>
              <span>العصر: {era}</span>
              <span>•</span>
              <span>بحر {bahr}</span>
              <span>•</span>
              <span>الأبيات: {toArabicDigits(getParsedVerses().length)} بيت</span>
            </p>
            <p className="text-xs text-ink-600">
              المصدر الصوتي: {audioSourceMode === "youtube" ? "مقطع YouTube" : audioSourceMode === "local" ? "ملف محلي" : "تخطي"}
            </p>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-2xl bg-charcoal-800 text-ink-400 text-xs flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>السابق</span>
            </button>

            <button
              type="button"
              onClick={handleStartProcessing}
              className="px-6 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-700 text-parchment-100 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent-700/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>بدء المعالجة والمحاذاة التلقائية</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Processing Pipeline (live view of the background queue job) */}
      {currentStep === 4 && (
        <div className="bg-charcoal-850 border border-white/5 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-accent-700" />
            <div>
              <h3 className="text-base font-bold text-parchment-100 font-heading">
                الخطوة الرابعة: خط المعالجة الذكي (يعمل في الخلفية)
              </h3>
              <p className="text-xs text-ink-600">
                يمكنك إغلاق المعالج أو التنقل بين الأقسام؛ ستتابع المعالجة في الخلفية وسيصلك إشعار عند الانتهاء
              </p>
            </div>
          </div>

          {activeJob ? (
            <div className="space-y-4">
              <div className="p-4 bg-charcoal-900 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-parchment-100">{activeJob.stageLabel || STAGE_DESCRIPTIONS[activeJob.stage] || activeJob.stage}</h5>
                  <span className="text-[11px] text-ink-600 ltr-num">{Math.round(activeJob.progress * 100)}%</span>
                </div>
                <div className="w-full bg-charcoal-800 h-2.5 border border-white/5 rounded-2xl overflow-hidden">
                  <div
                    className={`h-full rounded-2xl transition-all duration-300 ${
                      activeJob.status === "failed" ? "bg-crimson-500" : "bg-accent-700"
                    }`}
                    style={{ width: `${Math.max(4, Math.min(100, activeJob.progress * 100))}%` }}
                  />
                </div>
                {activeJob.status === "processing" && (
                  <p className="text-[11px] text-ink-600 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التنفيذ...</span>
                  </p>
                )}
                {activeJob.status === "failed" && activeJob.errorMessage && (
                  <div className="p-3 bg-red-800/10 border border-red-800/30 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-crimson-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-crimson-400">{activeJob.errorMessage}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-2xl bg-charcoal-800 text-ink-400 text-xs flex items-center gap-1"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>السابق</span>
                </button>

                <div className="flex items-center gap-2">
                  {(activeJob.status === "pending" || activeJob.status === "processing") && (
                    <button
                      onClick={() => cancelJob(activeJob.id)}
                      className="px-3 py-1.5 rounded-xl bg-charcoal-800 hover:bg-charcoal-800/70 text-ink-400 text-xs font-semibold border border-white/5"
                    >
                      إلغاء
                    </button>
                  )}
                  {activeJob.status === "failed" && (
                    <button
                      onClick={() => retryJob(activeJob.id)}
                      className="px-4 py-1.5 rounded-xl bg-red-800/20 hover:bg-red-800/30 text-rose-200 text-xs font-semibold"
                    >
                      إعادة المحاولة
                    </button>
                  )}
                  {activeJob.status === "cancelled" && (
                    <button
                      onClick={() => retryJob(activeJob.id)}
                      className="px-4 py-1.5 rounded-xl bg-accent-700/20 hover:bg-accent-700/30 text-accent-700 text-xs font-semibold"
                    >
                      إعادة المحاولة
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-600">لم يتم العثور على مهمة نشطة.</p>
          )}

          {reviewError && (
            <div className="p-3 bg-red-800/10 border border-red-800/30 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-crimson-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-crimson-400">{reviewError}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Review & Open Player */}
      {currentStep === 5 && generatedPoem && (
        <div className="bg-charcoal-850 border border-white/5 rounded-3xl p-8 space-y-6 animate-in fade-in duration-300 select-text text-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-parchment-100 font-poetry tracking-wide">
              تم استيراد ومعالجة قصيدة "{generatedPoem.title}" بنجاح!
            </h3>
            <p className="text-sm text-ink-500 mt-1.5 font-sans">
              تمت محاذاة {toArabicDigits(generatedPoem.versesCount)} بيت مع الصوت بدقة وتحديد فترات التوقف والصمت
            </p>
          </div>

          {/* Audio File Info & Audition */}
          {generatedPoem.recordings.length > 0 && generatedPoem.recordings[0].audioPath && (
            <div className="max-w-xl mx-auto bg-charcoal-950/40 p-4 rounded-2xl border border-white/5 text-right space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span className="font-semibold text-parchment-100">ملف التسجيل الصوتي المحفوظ:</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPoem.recordings[0].audioPath);
                  }}
                  className="text-accent-700 hover:text-accent-500 text-xs bg-white/5/[0.06] px-2.5 py-1 rounded-xl border border-white/10 transition-colors"
                >
                  نسخ المسار
                </button>
              </div>
              <div className="font-mono text-xs text-emerald-300 bg-black/60 p-2.5 rounded-xl border border-white/5 break-all select-all ltr-num">
                {generatedPoem.recordings[0].audioPath}
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-ink-500">استماع تجريبي:</span>
                <audio
                  controls
                  src={resolveAudioSrc(generatedPoem.recordings[0].audioPath)}
                  className="h-8 max-w-xs rounded-xl"
                />
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-4 border-t border-white/5">
            <button
              onClick={() => onFinishWizard(generatedPoem)}
              className="px-8 py-3.5 rounded-2xl bg-accent-700 from-accent-700 to-accent-600 hover:bg-accent-600  text-charcoal-950 font-bold text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all cursor-pointer"
            >
              <span>فتح القصيدة في المشغل المتزامن</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
