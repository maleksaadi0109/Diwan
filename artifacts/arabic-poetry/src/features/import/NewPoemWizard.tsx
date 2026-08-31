import React, { useState } from "react";
import { Poem, Era, Bahr } from "@/types";
import { AldewanProvider } from "@/lib/providers/AldewanProvider";
import type { ParsedPoemPayload, ParsedVersePayload } from "@/lib/providers/types";
import {
  fetchYoutubeVideoInfo,
  downloadYoutubeAudio,
  downloadYoutubeThumbnail,
  convertAudioFile,
  inspectAudioFile,
  detectSpeechIntervals,
  transcribeArabicAudio,
  alignPoemAudio,
  WorkerYouTubeInfoData,
} from "@/lib/worker/workerClient";
import { pickAudioFile, copyAudioToAppData, getPoemRecordingDirectory, resolveAudioSrc } from "@/lib/audio/fileManager";
import { DiwanRepository } from "@/lib/db/repository";
import { normalizeArabic, formatTime, toArabicDigits } from "@/lib/utils";
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
  LOGIN_REQUIRED: "يتطلب هذا المقطع تسجيل الدخول، وهو غير مدعوم حاليًا.",
  LIVE_STREAM_NOT_SUPPORTED: "تنزيل البث المباشر غير مدعوم.",
  NO_AUDIO_FORMAT: "لم يتم العثور على مسار صوتي مناسب.",
  DOWNLOAD_FAILED: "فشل تنزيل الصوت. افتح تفاصيل الخطأ للمزيد.",
  CONVERSION_FAILED: "تم تنزيل الملف، لكن تحويله إلى MP3 فشل.",
  OUTPUT_MISSING: "انتهت عملية التنزيل دون إنشاء ملف صوتي.",
  NETWORK_TIMEOUT: "انتهت مهلة الاتصال أثناء تنزيل الصوت.",
  FILESYSTEM_ERROR: "تعذر حفظ الصوت في مجلد التطبيق.",
};

function formatErrorMessage(err: unknown): string {
  if (!err) return "فشلت عملية المعالجة";
  const msg = (err as Error).message || String(err);
  for (const [code, arabicText] of Object.entries(ERROR_MAP)) {
    if (msg.includes(code)) {
      return arabicText;
    }
  }
  return msg;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

type StageStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  progress: number;
  errorMessage?: string;
}

export const NewPoemWizard: React.FC<NewPoemWizardProps> = ({ onFinishWizard }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Poem Data
  const [poemSourceMode, setPoemSourceMode] = useState<"aldiwan" | "manual" | "json">("aldiwan");
  const [aldiwanUrl, setAldiwanUrl] = useState("");
  const [aldiwanLoading, setAldiwanLoading] = useState(false);
  const [aldiwanError, setAldiwanError] = useState<string | null>(null);
  const [aldiwanPayload, setAldiwanPayload] = useState<ParsedPoemPayload | null>(null);
  const [aldiwanSourceText, setAldiwanSourceText] = useState("");

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

  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null);
  const [localAudioName, setLocalAudioName] = useState<string | null>(null);

  // Step 4: Pipeline Stages
  const [stages, setStages] = useState<PipelineStage[]>([
    { id: "download", name: "تنزيل الصوت من المصدر", description: "جلب الصوت بأعلى دقة", status: "pending", progress: 0 },
    { id: "convert", name: "التحويل والمعايرة الصوتية", description: "تحويل إلى 16kHz mono WAV", status: "pending", progress: 0 },
    { id: "vad", name: "كشف فترات الكلام والصمت", description: "تحليل VAD وحساب فترات التوقف", status: "pending", progress: 0 },
    { id: "asr", name: "التفريغ الصوتي بالذكاء الاصطناعي", description: "استخراج الكلمات والطوابع الزمنية", status: "pending", progress: 0 },
    { id: "align", name: "المحاذاة التلقائية للأبيات", description: "مطابقة النص القرآني/الشعري مع الصوت", status: "pending", progress: 0 },
  ]);

  const [generatedPoem, setGeneratedPoem] = useState<Poem | null>(null);

  // Parse raw verses
  const getParsedVerses = (): ParsedVersePayload[] => {
    if (poemSourceMode === "aldiwan" && aldiwanPayload && versesRaw === aldiwanSourceText) {
      return aldiwanPayload.verses;
    }

    const provider = new AldewanProvider();
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

  // Aldiwan.net Fetch Action
  const handleFetchAldiwan = async () => {
    if (!aldiwanUrl.trim()) return;
    setAldiwanLoading(true);
    setAldiwanError(null);
    try {
      const provider = new AldewanProvider();
      const parsed = await provider.fetchByUrl(aldiwanUrl.trim());
      const sourceText = parsed.verses
        .map((v) => `${v.firstHemistich} — ${v.secondHemistich}`)
        .join("\n");

      setTitle(parsed.title);
      setPoetName(parsed.poetName);
      setEra(parsed.era);
      setBahr(parsed.bahr);
      setRhyme(parsed.rhyme);
      setVersesRaw(sourceText);
      setAldiwanPayload(parsed);
      setAldiwanSourceText(sourceText);
    } catch (err: unknown) {
      setAldiwanError((err as Error).message || "تعذر جلب القصيدة من aldiwan.net");
    } finally {
      setAldiwanLoading(false);
    }
  };

  // YouTube Fetch Action
  const handleFetchYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setYoutubeLoading(true);
    setYoutubeError(null);
    try {
      const info = await fetchYoutubeVideoInfo(youtubeUrl.trim());
      setYoutubeInfo(info);
      setYoutubeCoverImage(null);
      if (info.thumbnail) {
        // Download the thumbnail server-side and store it as a data URL so
        // the cover image persists locally and works offline, instead of
        // relying on a live link to YouTube's CDN.
        downloadYoutubeThumbnail(info.thumbnail).then((dataUrl) => {
          setYoutubeCoverImage(dataUrl || info.thumbnail || null);
        });
      }
    } catch (err: unknown) {
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

  // Execute processing pipeline
  const runPipeline = async () => {
    setCurrentStep(4);
    const updateStage = (id: string, partial: Partial<PipelineStage>) => {
      setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
    };

    const parsedVerses = getParsedVerses();
    const importedFromAldiwan = poemSourceMode === "aldiwan"
      && aldiwanPayload !== null
      && versesRaw === aldiwanSourceText;
    const poemId = `poem-wiz-${Date.now()}`;
    const recId = `rec-wiz-${Date.now()}`;

    let sourceAudioPath = localAudioPath || "/recordings/mutanabbi_waharra.mp3";
    let processingWavPath = "/recordings/mutanabbi_waharra_16k.wav";
    // Real duration only — filled from YouTube metadata or audio inspection;
    // never a fabricated verse-count estimate.
    let durationMs = 0;

    // Track the resolved YouTube info/cover locally (not via React state) so the
    // pipeline works correctly even if the user never clicked "جلب" to fetch
    // the video info/thumbnail before starting the import.
    let resolvedYoutubeInfo = youtubeInfo;
    let resolvedCoverImage = youtubeCoverImage;

    try {
      // Stage 1: Download (if YouTube)
      if (audioSourceMode === "youtube" && youtubeUrl) {
        updateStage("download", { status: "running", progress: 0.2 });

        // Ensure we have the video info and cover image even if the user
        // skipped the explicit "fetch info" step.
        if (!resolvedYoutubeInfo) {
          try {
            resolvedYoutubeInfo = await fetchYoutubeVideoInfo(youtubeUrl.trim());
            setYoutubeInfo(resolvedYoutubeInfo);
          } catch (infoErr) {
            console.warn("Could not fetch YouTube video info before download:", infoErr);
          }
        }
        if (!resolvedCoverImage && resolvedYoutubeInfo?.thumbnail) {
          try {
            const dataUrl = await downloadYoutubeThumbnail(resolvedYoutubeInfo.thumbnail);
            resolvedCoverImage = dataUrl || resolvedYoutubeInfo.thumbnail;
            setYoutubeCoverImage(resolvedCoverImage);
          } catch (thumbErr) {
            console.warn("Could not download YouTube thumbnail before pipeline:", thumbErr);
            resolvedCoverImage = resolvedYoutubeInfo.thumbnail;
          }
        }

        const targetDir = await getPoemRecordingDirectory(poemId, recId);
        const ytRes = await downloadYoutubeAudio(youtubeUrl, targetDir, "192k");
        sourceAudioPath = ytRes.playback_audio_path;
        processingWavPath = ytRes.processing_audio_path;
        durationMs = ytRes.duration_ms;
        updateStage("download", { status: "completed", progress: 1.0 });
      } else {
        updateStage("download", { status: "completed", progress: 1.0 });
      }

      // Stage 2: Convert
      updateStage("convert", { status: "running", progress: 0.5 });
      if (audioSourceMode === "local" && localAudioPath && localAudioName) {
        sourceAudioPath = await copyAudioToAppData(localAudioPath, localAudioName);
        processingWavPath = sourceAudioPath.replace(/\.[^.]+$/, "_16k.wav");
        await convertAudioFile(sourceAudioPath, processingWavPath);
        if (!durationMs) {
          try {
            const meta = await inspectAudioFile(sourceAudioPath);
            durationMs = meta.duration_ms;
          } catch {
            // duration stays 0 (unknown); never fabricated
          }
        }
      }
      updateStage("convert", { status: "completed", progress: 1.0 });

      // Stage 3: VAD
      updateStage("vad", { status: "running", progress: 0.5 });
      await detectSpeechIntervals(processingWavPath);
      updateStage("vad", { status: "completed", progress: 1.0 });

      // Stage 4: ASR
      updateStage("asr", { status: "running", progress: 0.5 });
      const transcription = await transcribeArabicAudio(processingWavPath, undefined, {
        model_size: "small",
        device: "cpu",
      });
      updateStage("asr", { status: "completed", progress: 1.0 });

      // Stage 5: Forced Alignment with silence switching
      updateStage("align", { status: "running", progress: 0.5 });
      const alignRes = await alignPoemAudio(
        processingWavPath,
        parsedVerses.map((v) => ({
          id: `v-${poemId}-${v.orderIndex}`,
          orderIndex: v.orderIndex,
          text: v.text,
          firstHemistich: v.firstHemistich,
          secondHemistich: v.secondHemistich,
        })),
        poemId,
        recId,
        { transcript: transcription.transcript }
      );
      updateStage("align", { status: "completed", progress: 1.0 });

      // Construct final Poem
      const finalPoem: Poem = {
        id: poemId,
        title: title.trim() || "قصيدة جديدة",
        poet: {
          id: `poet-${Date.now()}`,
          name: poetName.trim() || "شاعر",
          era,
        },
        era,
        bahr,
        rhyme: rhyme || "الميم",
        versesCount: parsedVerses.length,
        tags: ["مستورد عبر المعالج", `بحر ${bahr}`],
        externalProvider: importedFromAldiwan ? "aldewan" : undefined,
        sourceUrl: importedFromAldiwan ? aldiwanUrl.trim() : undefined,
        coverImageUrl: resolvedCoverImage || resolvedYoutubeInfo?.thumbnail || undefined,
        verses: parsedVerses.map((v) => {
          const alignmentItem = alignRes.alignments.find((a) => a.order_index === v.orderIndex);
          return {
            id: `v-${poemId}-${v.orderIndex}`,
            poemId,
            orderIndex: v.orderIndex,
            text: v.text,
            normalizedText: normalizeArabic(v.text),
            firstHemistich: v.firstHemistich,
            secondHemistich: v.secondHemistich,
            externalId: v.externalId,
            alignment: alignmentItem
              ? {
                  id: `align-${poemId}-${v.orderIndex}`,
                  verseId: `v-${poemId}-${v.orderIndex}`,
                  recordingId: recId,
                  startMs: alignmentItem.start_ms,
                  endMs: alignmentItem.end_ms,
                  confidence: alignmentItem.confidence,
                  status: alignmentItem.status,
                }
              : undefined,
          };
        }),
        recordings: [
          {
            id: recId,
            poemId,
            title: resolvedYoutubeInfo?.title || localAudioName || "تسجيل صوتي",
            reciter: poetName.trim(),
            audioPath: sourceAudioPath,
            durationMs,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      // Save to SQLite
      const repo = await DiwanRepository.create();
      await repo.savePoem(finalPoem);

      setGeneratedPoem(finalPoem);
      setCurrentStep(5);
    } catch (err: unknown) {
      const error = err as Error;
      // Mark running stage as failed
      setStages((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "failed", errorMessage: error.message } : s))
      );
    }
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
                اختر استيراد القصيدة من الديوان (aldiwan.net) أو كتابتها ولصقها يدوياً
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-1 bg-charcoal-900 rounded-2xl border border-white/5">
            <button
              onClick={() => setPoemSourceMode("aldiwan")}
              className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                poemSourceMode === "aldiwan" ? "bg-accent-700 text-parchment-100" : "text-ink-600 hover:text-parchment-100"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>الديوان (aldiwan.net)</span>
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

          {/* Aldiwan.net URL Input */}
          {poemSourceMode === "aldiwan" && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-ink-400">
                رابط القصيدة في موقع الديوان (aldiwan.net):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={aldiwanUrl}
                  onChange={(e) => setAldiwanUrl(e.target.value)}
                  placeholder="https://www.aldiwan.net/poem81.html"
                  className="flex-1 bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-accent-700 ltr-num"
                />
                <button
                  type="button"
                  onClick={handleFetchAldiwan}
                  disabled={!aldiwanUrl.trim() || aldiwanLoading}
                  className="px-4 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-700 disabled:opacity-50 text-parchment-100 font-bold text-xs"
                >
                  {aldiwanLoading ? "جاري الجلب..." : "جلب النص"}
                </button>
              </div>
              {aldiwanError && <p className="text-xs text-crimson-400">{aldiwanError}</p>}
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
              onClick={runPipeline}
              className="px-6 py-2.5 rounded-2xl bg-accent-700 hover:bg-accent-700 text-parchment-100 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent-700/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>بدء المعالجة والمحاذاة التلقائية</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Processing Pipeline */}
      {currentStep === 4 && (
        <div className="bg-charcoal-850 border border-white/5 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-accent-700" />
            <div>
              <h3 className="text-base font-bold text-parchment-100 font-heading">
                الخطوة الرابعة: خط المعالجة الذكي (Processing Pipeline)
              </h3>
              <p className="text-xs text-ink-600">
                متابعة مراحل المعالجة بالذكاء الاصطناعي مع إمكانية إعادة المحاولة عند اللزوم
              </p>
            </div>
          </div>

          {/* Stages List */}
          <div className="space-y-3">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className="p-3.5 bg-charcoal-900 rounded-2xl border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-2xl flex items-center justify-center text-xs ${
                      stage.status === "completed"
                        ? "bg-emerald-600/20 text-emerald-400"
                        : stage.status === "running"
                        ? "bg-accent-700/20 text-accent-700 animate-pulse"
                        : stage.status === "failed"
                        ? "bg-red-800/20 text-crimson-400"
                        : "bg-charcoal-800 text-ink-600"
                    }`}
                  >
                    {stage.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : stage.status === "running" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : stage.status === "failed" ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <span className="w-2 h-2 rounded-2xl border-white/5" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-parchment-100">{stage.name}</h5>
                    <p className="text-[11px] text-ink-600">{stage.description}</p>
                    {stage.errorMessage && <p className="text-[11px] text-crimson-400 mt-0.5">{stage.errorMessage}</p>}
                  </div>
                </div>

                {stage.status === "failed" && (
                  <button
                    onClick={runPipeline}
                    className="px-3 py-1 rounded bg-red-800/20 hover:bg-red-800/30 text-rose-200 text-xs font-semibold"
                  >
                    إعادة المحاولة
                  </button>
                )}
              </div>
            ))}
          </div>
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
