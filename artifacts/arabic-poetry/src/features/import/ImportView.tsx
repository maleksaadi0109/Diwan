import React, { useState } from "react";
import { Era, Bahr, Poem } from "@/types";
import { normalizeArabic } from "@/lib/utils";
import { Upload, CheckCircle, Music, Mic, Wand2, Globe, Edit3 } from "lucide-react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { pickAudioFile, copyAudioToAppData } from "@/lib/audio/fileManager";
import {
  transcribeArabicAudio,
  alignPoemAudio,
  inspectAudioFile,
  TranscriptResult,
  PoemAlignmentResponse,
} from "@/lib/worker/workerClient";
import { TranscriptionModal } from "./TranscriptionModal";
import { MizanImportView } from "./MizanImportView";
import { YouTubeImportView } from "./YouTubeImportView";
import { NewPoemWizard } from "./NewPoemWizard";

interface ImportViewProps {
  onImportPoem: (poem: Poem) => void;
}

type ImportTab = "wizard" | "mizan" | "youtube" | "manual";

const ERAS: Era[] = [
  "جاهلي",
  "إسلامي",
  "أموي",
  "عباسي",
  "أندلسي",
  "مملوكي",
  "عثماني",
  "حديث",
  "معاصر",
];

const BUHOOR: Bahr[] = [
  "الطويل",
  "البسيط",
  "الكامل",
  "الوافر",
  "الخفيف",
  "الرمل",
  "الرجز",
  "المتقارب",
  "المتدارك",
  "السريع",
  "المنسرح",
];

export const ImportView: React.FC<ImportViewProps> = ({ onImportPoem }) => {
  const [activeTab, setActiveTab] = useState<ImportTab>("wizard");

  // Manual Tab Form State
  const [title, setTitle] = useState("");
  const [poetName, setPoetName] = useState("");
  const [era, setEra] = useState<Era>("عباسي");
  const [bahr, setBahr] = useState<Bahr>("البسيط");
  const [versesRaw, setVersesRaw] = useState("");
  const [rhyme, setRhyme] = useState("");
  const [delimiter, setDelimiter] = useState("...");
  const [audioSourcePath, setAudioSourcePath] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // ASR Transcription Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState("");
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // Parse raw text into structured verses
  const parseVerses = () => {
    const lines = versesRaw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return lines.map((line, index) => {
      let first = line;
      let second = "";

      if (delimiter && line.includes(delimiter)) {
        const parts = line.split(delimiter);
        first = parts[0].trim();
        second = parts.slice(1).join(delimiter).trim();
      } else if (line.includes(" - ")) {
        const parts = line.split(" - ");
        first = parts[0].trim();
        second = parts[1].trim();
      } else if (line.includes("   ")) {
        const parts = line.split(/\s{3,}/);
        first = parts[0].trim();
        second = parts[1].trim();
      }

      return {
        id: `imported-v-${index + 1}`,
        poemId: "temp-id",
        orderIndex: index + 1,
        text: line,
        normalizedText: normalizeArabic(line),
        firstHemistich: first,
        secondHemistich: second,
      };
    });
  };

  const parsedVerses = parseVerses();

  const handlePickAudio = async () => {
    const picked = await pickAudioFile();
    if (picked) {
      setAudioSourcePath(picked.path);
      setAudioFileName(picked.name);
    }
  };

  const handleStartTranscribe = async () => {
    if (!audioSourcePath) return;

    setIsModalOpen(true);
    setIsTranscribing(true);
    setTranscribeProgress(0.1);
    setStageMessage("جاري إرسال الملف إلى معالج الصوت العربي...");
    setTranscribeError(null);
    setTranscriptResult(null);

    try {
      setTranscribeProgress(0.4);
      setStageMessage("جاري استخراج الكلمات وطوابعها الزمنية بالذكاء الاصطناعي...");

      const res = await transcribeArabicAudio(audioSourcePath, undefined, {
        model_size: "small",
        device: "cpu",
      });

      setTranscribeProgress(1.0);
      setStageMessage("اكتمل التفريغ الصوتي بنجاح!");
      setTranscriptResult(res.transcript);
    } catch (err: unknown) {
      const error = err as Error;
      setTranscribeError(error.message || "فشلت عملية التفريغ الصوتي");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleApplyTranscript = (transcript: TranscriptResult) => {
    if (!versesRaw.trim()) {
      setVersesRaw(transcript.raw_text);
    }
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !poetName.trim() || parsedVerses.length === 0) return;

    setIsProcessing(true);
    try {
      let savedAudioPath = "";
      if (audioSourcePath && audioFileName) {
        savedAudioPath = await copyAudioToAppData(audioSourcePath, audioFileName);
      }

      const poemId = `poem-custom-${Date.now()}`;
      const recId = `rec-${Date.now()}`;

      // Run the real hybrid alignment (ASR + VAD) when audio is attached —
      // never fabricate fixed 8-second boundaries.
      let alignments: PoemAlignmentResponse["alignments"] = [];
      let recordingDurationMs = 0;
      if (savedAudioPath) {
        try {
          const meta = await inspectAudioFile(savedAudioPath);
          recordingDurationMs = meta.duration_ms;
          const alignRes = await alignPoemAudio(
            savedAudioPath,
            parsedVerses.map((v) => ({
              id: v.id,
              orderIndex: v.orderIndex,
              text: v.text,
              firstHemistich: v.firstHemistich,
              secondHemistich: v.secondHemistich,
            })),
            poemId,
            recId,
            transcriptResult ? { transcript: transcriptResult } : undefined
          );
          alignments = alignRes.alignments;
        } catch (alignErr) {
          console.warn("Alignment failed; saving without alignment:", alignErr);
          setSuccessMessage(null);
          setTranscribeError(
            alignErr instanceof Error
              ? `تعذرت المحاذاة التلقائية: ${alignErr.message}. حُفظت القصيدة بدون محاذاة، يمكنك ضبط الحدود يدويًا من المحرر.`
              : "تعذرت المحاذاة التلقائية. حُفظت القصيدة بدون محاذاة."
          );
        }
      }

      const newPoem: Poem = {
        id: poemId,
        title: title.trim(),
        poet: {
          id: `poet-${Date.now()}`,
          name: poetName.trim(),
          era,
        },
        era,
        bahr,
        rhyme: rhyme.trim() || "غير محدد",
        versesCount: parsedVerses.length,
        verses: parsedVerses.map((v, i) => {
          const item = alignments.find((a) => a.order_index === v.orderIndex);
          return {
            ...v,
            poemId,
            alignment: item
              ? {
                  id: `align-${poemId}-${i + 1}`,
                  verseId: v.id,
                  recordingId: recId,
                  startMs: item.start_ms,
                  endMs: item.end_ms,
                  confidence: item.confidence,
                  status: item.status,
                }
              : undefined,
          };
        }),
        recordings: savedAudioPath
          ? [
              {
                id: recId,
                poemId,
                title: audioFileName || "تسجيل صوتي",
                reciter: poetName.trim(),
                audioPath: savedAudioPath,
                durationMs: recordingDurationMs,
                createdAt: new Date().toISOString().split("T")[0],
              },
            ]
          : [],
        tags: ["مستورد يدوياً"],
      };

      onImportPoem(newPoem);
      setSuccessMessage("تم حفظ القصيدة بنجاح في ديوان!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6 max-w-5xl mx-auto w-full select-none">
      {/* Top Header with Navigation Tabs */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-charcoal-850 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-parchment-100 font-poetry">
            مركز استيراد القصائد والتسجيلات
          </h2>
          <p className="text-xs text-parchment-400 mt-1">
            استيراد النصوص المحققة والتسجيلات الصوتية عبر معالج ذكي متكامل
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-charcoal-900 p-1 rounded-xl border border-charcoal-800 shrink-0">
          <button
            onClick={() => setActiveTab("wizard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === "wizard"
                ? "bg-gold-500 text-charcoal-950 shadow-sm"
                : "text-parchment-400 hover:text-parchment-200"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>المعالج الشامل</span>
          </button>
          <button
            onClick={() => setActiveTab("mizan")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === "mizan"
                ? "bg-gold-500 text-charcoal-950 shadow-sm"
                : "text-parchment-400 hover:text-parchment-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>ميزان العرب</span>
          </button>
          <button
            onClick={() => setActiveTab("youtube")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === "youtube"
                ? "bg-gold-500 text-charcoal-950 shadow-sm"
                : "text-parchment-400 hover:text-parchment-200"
            }`}
          >
            <YoutubeIcon className="w-3.5 h-3.5" />
            <span>YouTube</span>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === "manual"
                ? "bg-gold-500 text-charcoal-950 shadow-sm"
                : "text-parchment-400 hover:text-parchment-200"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>إدخال يدوي</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Wizard */}
      {activeTab === "wizard" && <NewPoemWizard onFinishWizard={onImportPoem} />}

      {/* Tab 2: Mizan Al-Arab */}
      {activeTab === "mizan" && <MizanImportView onPoemImported={onImportPoem} />}

      {/* Tab 3: YouTube */}
      {activeTab === "youtube" && (
        <YouTubeImportView
          onAudioDownloaded={(res, info) => {
            setAudioSourcePath(res.playback_audio_path);
            setAudioFileName(`${info.title}.mp3`);
            setTitle(info.title);
            setSuccessMessage(`تم تنزيل ومعالجة الصوت بنجاح (${info.title}). يمكنك إكمال البيانات وحفظ القصيدة.`);
          }}
        />
      )}

      {/* Tab 4: Manual Form */}
      {activeTab === "manual" && (
        <form onSubmit={handleSave} className="space-y-6 select-text">
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Basic metadata grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-parchment-300 mb-1.5">
                عنوان القصيدة *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: واحر قلباه ممن قلبه شبم"
                className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-parchment-300 mb-1.5">
                اسم الشاعر *
              </label>
              <input
                type="text"
                required
                value={poetName}
                onChange={(e) => setPoetName(e.target.value)}
                placeholder="مثال: أبو الطيب المتنبي"
                className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-parchment-300 mb-1.5">
                العصر الأدبي
              </label>
              <select
                value={era}
                onChange={(e) => setEra(e.target.value as Era)}
                className="w-full bg-charcoal-850 text-parchment-100 border border-charcoal-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-500"
              >
                {ERAS.map((e) => (
                  <option key={e} value={e}>
                    العصر ال{e}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-parchment-300 mb-1.5">
                بحر القصيدة
              </label>
              <select
                value={bahr}
                onChange={(e) => setBahr(e.target.value as Bahr)}
                className="w-full bg-charcoal-850 text-parchment-100 border border-charcoal-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-500"
              >
                {BUHOOR.map((b) => (
                  <option key={b} value={b}>
                    بحر {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-parchment-300 mb-1.5">
                القافية والرويّ
              </label>
              <input
                type="text"
                value={rhyme}
                onChange={(e) => setRhyme(e.target.value)}
                placeholder="مثال: الميم المضمومة (ـمُ)"
                className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-gold-500"
              />
            </div>
          </div>

          {/* Verses input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-parchment-300">
                أبيات القصيدة (بيت في كل سطر) *
              </label>
              <div className="flex items-center gap-2 text-xs text-parchment-400">
                <span>فاصل الشطرين:</span>
                <input
                  type="text"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="w-16 bg-charcoal-850 border border-charcoal-700 rounded px-2 py-0.5 text-center text-xs text-gold-300"
                />
              </div>
            </div>
            <textarea
              rows={6}
              required
              value={versesRaw}
              onChange={(e) => setVersesRaw(e.target.value)}
              placeholder="واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ"
              className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/40 border border-charcoal-700 rounded-xl p-4 text-xs font-poetry leading-relaxed focus:outline-none focus:border-gold-500 font-normal"
            />
          </div>

          {/* Audio file selection */}
          <div className="p-6 rounded-2xl bg-charcoal-900 border border-dashed border-charcoal-700 text-center hover:border-gold-500/50 transition-colors">
            <Upload className="w-8 h-8 text-gold-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-parchment-200 mb-1">
              إرفاق ملف صوتي محلي (MP3, WAV, M4A, OGG)
            </h4>
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                type="button"
                onClick={handlePickAudio}
                className="px-5 py-2.5 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-gold-400 border border-charcoal-700 text-xs font-semibold flex items-center gap-2"
              >
                <Music className="w-4 h-4" />
                <span>{audioFileName ? `تم اختيار: ${audioFileName}` : "اختيار ملف صوتي..."}</span>
              </button>
              {audioSourcePath && (
                <button
                  type="button"
                  onClick={handleStartTranscribe}
                  className="px-4 py-2.5 rounded-xl bg-gold-500/15 hover:bg-gold-500/25 text-gold-300 border border-gold-500/30 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Mic className="w-4 h-4" />
                  <span>بدء التفريغ الصوتي</span>
                </button>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={parsedVerses.length === 0 || !title.trim() || !poetName.trim() || isProcessing}
              className="px-6 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-charcoal-950 font-bold text-xs shadow-md"
            >
              {isProcessing ? "جاري الحفظ..." : "حفظ القصيدة في ديوان"}
            </button>
          </div>
        </form>
      )}

      {/* ASR Modal */}
      <TranscriptionModal
        isOpen={isModalOpen}
        isTranscribing={isTranscribing}
        progress={transcribeProgress}
        stageMessage={stageMessage}
        transcript={transcriptResult}
        errorMessage={transcribeError}
        onClose={() => setIsModalOpen(false)}
        onApplyTranscript={handleApplyTranscript}
      />
    </div>
  );
};
