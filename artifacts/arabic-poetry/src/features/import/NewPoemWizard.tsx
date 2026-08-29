import React, { useState } from "react";
import { Poem, Era, Bahr } from "@/types";
import { MizanAlArabProvider } from "@/lib/providers/MizanAlArabProvider";
import type { ParsedPoemPayload, ParsedVersePayload } from "@/lib/providers/types";
import {
  fetchYoutubeVideoInfo,
  downloadYoutubeAudio,
  convertAudioFile,
  inspectAudioFile,
  detectSpeechIntervals,
  transcribeArabicAudio,
  alignPoemAudio,
  WorkerYouTubeInfoData,
} from "@/lib/worker/workerClient";
import { pickAudioFile, copyAudioToAppData, getPoemRecordingDirectory } from "@/lib/audio/fileManager";
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
      const info = await fetchYoutubeVideoInfo(youtubeUrl.trim());
      setYoutubeInfo(info);
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
    const importedFromMizan = poemSourceMode === "mizan"
      && mizanPayload !== null
      && mizanPoemId !== null
      && versesRaw === mizanSourceText;
    const poemId = `poem-wiz-${Date.now()}`;
    const recId = `rec-wiz-${Date.now()}`;

    let sourceAudioPath = localAudioPath || "/recordings/mutanabbi_waharra.mp3";
    let processingWavPath = "/recordings/mutanabbi_waharra_16k.wav";
    // Real duration only — filled from YouTube metadata or audio inspection;
    // never a fabricated verse-count estimate.
    let durationMs = 0;

    try {
      // Stage 1: Download (if YouTube)
      if (audioSourceMode === "youtube" && youtubeUrl) {
        updateStage("download", { status: "running", progress: 0.2 });
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
        externalProvider: importedFromMizan ? "mizan_al_arab" : undefined,
        externalId: importedFromMizan ? mizanPoemId : undefined,
        sourceUrl: importedFromMizan ? mizanUrl.trim() : undefined,
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
            externalId: importedFromMizan ? v.externalId : undefined,
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
            title: youtubeInfo?.title || localAudioName || "تسجيل صوتي",
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
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  currentStep === s.step
                    ? "bg-crimson-800 text-sand-50 shadow-lg shadow-crimson-800/20"
                    : currentStep > s.step
                    ? "bg-emerald-500 text-sand-50"
                    : "bg-sand-200 text-ink-600"
                }`}
              >
                {currentStep > s.step ? <CheckCircle2 className="w-4 h-4" /> : s.step}
              </div>
              <span
                className={`text-[11px] mt-1.5 font-medium ${
                  currentStep === s.step ? "text-crimson-700" : "text-ink-600"
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
        <div className="bg-sand-50 border border-sand-300 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-crimson-700" />
            <div>
              <h3 className="text-base font-bold text-ink-900 font-poetry">
                الخطوة الأولى: مصدر نص القصيدة وبياناتها
              </h3>
              <p className="text-xs text-ink-600">
                اختر استيراد القصيدة من ميزان العرب أو كتابتها ولصقها يدوياً
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-1 bg-sand-100 rounded-xl border border-sand-300">
            <button
              onClick={() => setPoemSourceMode("mizan")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                poemSourceMode === "mizan" ? "bg-crimson-800 text-sand-50" : "text-ink-600 hover:text-ink-800"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>ميزان العرب (Mizan Al-Arab)</span>
            </button>
            <button
              onClick={() => setPoemSourceMode("manual")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                poemSourceMode === "manual" ? "bg-crimson-800 text-sand-50" : "text-ink-600 hover:text-ink-800"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>إدخال ولصق يدوي</span>
            </button>
          </div>

          {/* Mizan URL Input */}
          {poemSourceMode === "mizan" && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-ink-700">
                رابط القصيدة في موقع ميزان العرب:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={mizanUrl}
                  onChange={(e) => setMizanUrl(e.target.value)}
                  placeholder="https://mizanalarab.com/poem/12345"
                  className="flex-1 bg-white text-ink-900 border border-sand-400 rounded-xl px-4 py-2.5 text-xs focus:border-crimson-800 ltr-num"
                />
                <button
                  type="button"
                  onClick={handleFetchMizan}
                  disabled={!mizanUrl.trim() || mizanLoading}
                  className="px-4 py-2.5 rounded-xl bg-crimson-800 hover:bg-crimson-700 disabled:opacity-50 text-sand-50 font-bold text-xs"
                >
                  {mizanLoading ? "جاري الجلب..." : "جلب النص"}
                </button>
              </div>
              {mizanError && <p className="text-xs text-rose-400">{mizanError}</p>}
            </div>
          )}

          {/* Poem Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">عنوان القصيدة *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان القصيدة"
                className="w-full bg-white text-ink-900 border border-sand-400 rounded-xl px-4 py-2 text-xs focus:border-crimson-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">اسم الشاعر *</label>
              <input
                type="text"
                value={poetName}
                onChange={(e) => setPoetName(e.target.value)}
                placeholder="اسم الشاعر"
                className="w-full bg-white text-ink-900 border border-sand-400 rounded-xl px-4 py-2 text-xs focus:border-crimson-800"
              />
            </div>
          </div>

          {/* Verses textarea */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              أبيات القصيدة (كل بيت في سطر مع فاصل " — " أو " - ") *
            </label>
            <textarea
              rows={6}
              value={versesRaw}
              onChange={(e) => setVersesRaw(e.target.value)}
              placeholder="واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ — وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ"
              className="w-full bg-white text-ink-900 border border-sand-400 rounded-xl p-3 text-xs font-poetry leading-relaxed focus:border-crimson-800"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!title.trim() || !poetName.trim() || !versesRaw.trim()}
              className="px-6 py-2.5 rounded-xl bg-crimson-800 hover:bg-crimson-700 disabled:opacity-50 text-sand-50 font-bold text-xs flex items-center gap-1.5"
            >
              <span>المتابعة إلى اختيار الصوت</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Audio Source */}
      {currentStep === 2 && (
        <div className="bg-sand-50 border border-sand-300 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-crimson-700" />
            <div>
              <h3 className="text-base font-bold text-ink-900 font-poetry">
                الخطوة الثانية: اختيار التسجيل الصوتي
              </h3>
              <p className="text-xs text-ink-600">
                استيراد تسجيل بصوت ملقي القصيدة من YouTube أو ملف محلي
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-1 bg-sand-100 rounded-xl border border-sand-300">
            <button
              onClick={() => setAudioSourceMode("youtube")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                audioSourceMode === "youtube" ? "bg-crimson-800 text-sand-50" : "text-ink-600 hover:text-ink-800"
              }`}
            >
              <YoutubeIcon className="w-3.5 h-3.5" />
              <span>رابط YouTube</span>
            </button>
            <button
              onClick={() => setAudioSourceMode("local")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                audioSourceMode === "local" ? "bg-crimson-800 text-sand-50" : "text-ink-600 hover:text-ink-800"
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>ملف صوتي محلي</span>
            </button>
            <button
              onClick={() => setAudioSourceMode("skip")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                audioSourceMode === "skip" ? "bg-crimson-800 text-sand-50" : "text-ink-600 hover:text-ink-800"
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
                  className="flex-1 bg-white text-ink-900 border border-sand-400 rounded-xl px-4 py-2.5 text-xs focus:border-crimson-800 ltr-num"
                />
                <button
                  type="button"
                  onClick={handleFetchYoutube}
                  disabled={!youtubeUrl.trim() || youtubeLoading}
                  className="px-4 py-2.5 rounded-xl bg-crimson-800 hover:bg-crimson-700 disabled:opacity-50 text-sand-50 font-bold text-xs"
                >
                  {youtubeLoading ? "جاري الفحص..." : "فحص المقطع"}
                </button>
              </div>
              {youtubeError && <p className="text-xs text-rose-400">{youtubeError}</p>}
              {youtubeInfo && (
                <div className="p-3 bg-sand-100 rounded-xl border border-sand-300 flex gap-3 items-center">
                  {youtubeInfo.thumbnail && (
                    <img src={youtubeInfo.thumbnail} alt="" className="w-20 h-14 object-cover rounded-lg" />
                  )}
                  <div className="text-xs">
                    <h5 className="font-bold text-ink-900">{youtubeInfo.title}</h5>
                    <p className="text-ink-600">{youtubeInfo.channel} • {formatTime(youtubeInfo.duration_ms)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Local File Option */}
          {audioSourceMode === "local" && (
            <div className="p-6 bg-sand-100 rounded-xl border border-dashed border-sand-400 text-center">
              <button
                type="button"
                onClick={handlePickLocal}
                className="px-4 py-2 rounded-xl bg-sand-200 hover:bg-sand-300 text-crimson-700 text-xs font-semibold border border-sand-400"
              >
                {localAudioName ? `تم اختيار: ${localAudioName}` : "اختيار ملف صوتي محلي..."}
              </button>
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl bg-sand-200 text-ink-700 text-xs flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>السابق</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-2.5 rounded-xl bg-crimson-800 hover:bg-crimson-700 text-sand-50 font-bold text-xs flex items-center gap-1.5"
            >
              <span>المتابعة إلى المعاينة</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Confirm */}
      {currentStep === 3 && (
        <div className="bg-sand-50 border border-sand-300 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-crimson-700" />
            <div>
              <h3 className="text-base font-bold text-ink-900 font-poetry">
                الخطوة الثالثة: المعاينة والتأكيد
              </h3>
              <p className="text-xs text-ink-600">
                تأكد من صحة البيانات قبل بدء المعالجة الآلية والمحاذاة
              </p>
            </div>
          </div>

          {/* Overview summary */}
          <div className="p-4 bg-sand-100 rounded-xl border border-sand-300 space-y-2">
            <h4 className="font-poetry text-lg font-bold text-crimson-600">{title}</h4>
            <p className="text-xs text-ink-700 flex items-center gap-2">
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
              className="px-4 py-2 rounded-xl bg-sand-200 text-ink-700 text-xs flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>السابق</span>
            </button>

            <button
              type="button"
              onClick={runPipeline}
              className="px-6 py-2.5 rounded-xl bg-crimson-800 hover:bg-crimson-700 text-sand-50 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-crimson-800/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>بدء المعالجة والمحاذاة التلقائية</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Processing Pipeline */}
      {currentStep === 4 && (
        <div className="bg-sand-50 border border-sand-300 rounded-2xl p-6 space-y-6 animate-fadeIn select-text">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-crimson-700" />
            <div>
              <h3 className="text-base font-bold text-ink-900 font-poetry">
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
                className="p-3.5 bg-sand-100 rounded-xl border border-sand-300 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      stage.status === "completed"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : stage.status === "running"
                        ? "bg-crimson-800/20 text-crimson-700 animate-pulse"
                        : stage.status === "failed"
                        ? "bg-rose-500/20 text-rose-400"
                        : "bg-sand-200 text-ink-600"
                    }`}
                  >
                    {stage.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : stage.status === "running" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : stage.status === "failed" ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-sand-300" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-ink-900">{stage.name}</h5>
                    <p className="text-[11px] text-ink-600">{stage.description}</p>
                    {stage.errorMessage && <p className="text-[11px] text-rose-400 mt-0.5">{stage.errorMessage}</p>}
                  </div>
                </div>

                {stage.status === "failed" && (
                  <button
                    onClick={runPipeline}
                    className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold"
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
        <div className="bg-sand-50 border border-sand-300 rounded-2xl p-6 space-y-6 animate-fadeIn select-text text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-ink-900 font-poetry">
              تم استيراد ومعالجة قصيدة "{generatedPoem.title}" بنجاح!
            </h3>
            <p className="text-xs text-ink-600 mt-1">
              تمت محاذاة {toArabicDigits(generatedPoem.versesCount)} بيت مع الصوت بدقة وتحديد فترات التوقف والصمت
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onFinishWizard(generatedPoem)}
              className="px-6 py-2.5 rounded-xl bg-crimson-800 hover:bg-crimson-700 text-sand-50 font-bold text-xs flex items-center gap-2 shadow-lg"
            >
              <span>فتح القصيدة في المشغل المتزامن</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
