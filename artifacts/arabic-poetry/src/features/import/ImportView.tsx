import React, { useState } from "react";
import { Era, Bahr, Poem } from "@/types";
import { normalizeArabic } from "@/lib/utils";
import { Upload, CheckCircle, Music, Mic, Wand2, Globe, Edit3, Save, Sparkles } from "lucide-react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { pickAudioFile, copyAudioToAppData } from "@/lib/audio/fileManager";
import {
  transcribeArabicAudio,
  alignPoemAudio,
  inspectAudioFile,
  downloadYoutubeThumbnail,
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
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
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
        coverImageUrl: coverImageUrl || undefined,
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
    <div className="h-full overflow-y-auto px-4 md:px-12 py-8 md:py-10 max-w-6xl mx-auto w-full select-none scroll-smooth text-parchment-100 pb-24 md:pb-12">
      {/* Top Header with Navigation Tabs */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <h2 className="text-4xl md:text-5xl font-bold text-parchment-100 font-heading">
            استيراد القصائد
          </h2>
          <p className="text-sm text-ink-500 mt-3 font-sans max-w-xl">
            استيراد النصوص المحققة والتسجيلات الصوتية عبر معالج ذكي متكامل للمحاذاة والتعرف على الصوت
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap bg-charcoal-850 p-1.5 rounded-2xl border border-white/5 shrink-0 shadow-md gap-1">
          <button
            onClick={() => setActiveTab("wizard")}
            className={`px-4 py-2.5 text-xs font-bold font-sans transition-all flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
              activeTab === "wizard"
                ? "bg-accent-700 text-charcoal-950 shadow-md"
                : "bg-transparent text-ink-500 hover:bg-white/5 hover:text-parchment-100"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span>المعالج الذكي</span>
          </button>
          <button
            onClick={() => setActiveTab("mizan")}
            className={`px-4 py-2.5 text-xs font-bold font-sans transition-all flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
              activeTab === "mizan"
                ? "bg-accent-700 text-charcoal-950 shadow-md"
                : "bg-transparent text-ink-500 hover:bg-white/5 hover:text-parchment-100"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>ميزان العرب</span>
          </button>
          <button
            onClick={() => setActiveTab("youtube")}
            className={`px-4 py-2.5 text-xs font-bold font-sans transition-all flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
              activeTab === "youtube"
                ? "bg-accent-700 text-charcoal-950 shadow-md"
                : "bg-transparent text-ink-500 hover:bg-white/5 hover:text-parchment-100"
            }`}
          >
            <YoutubeIcon className="w-4 h-4 fill-current" />
            <span>يوتيوب</span>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2.5 text-xs font-bold font-sans transition-all flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
              activeTab === "manual"
                ? "bg-accent-700 text-charcoal-950 shadow-md"
                : "bg-transparent text-ink-500 hover:bg-white/5 hover:text-parchment-100"
            }`}
          >
            <Edit3 className="w-4 h-4" />
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
            if (info.thumbnail) {
              setCoverImageUrl(info.thumbnail);
              downloadYoutubeThumbnail(info.thumbnail)
                .then((dataUrl) => {
                  if (dataUrl) setCoverImageUrl(dataUrl);
                })
                .catch(() => {
                  // keep the raw thumbnail URL fallback already set above
                });
            }
          }}
        />
      )}

      {/* Tab 4: Manual Form */}
      {activeTab === "manual" && (
        <form onSubmit={handleSave} className="space-y-8 select-text animate-fade-in max-w-4xl mx-auto pb-10">
          {successMessage && (
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 font-sans font-bold shadow-md rounded-2xl">
              <CheckCircle className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="bg-charcoal-850 rounded-3xl p-6 md:p-8 border border-white/5 shadow-md space-y-6">
            <h3 className="font-bold text-2xl text-parchment-100 border-b border-white/5 pb-4 font-heading flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-accent-700" />
              <span>معلومات القصيدة الأساسية</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
              <div>
                <label className="block text-sm font-bold text-ink-500 mb-2">عنوان القصيدة <span className="text-crimson-400">*</span></label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: واحر قلباه ممن قلبه شبم"
                  className="w-full bg-charcoal-950 text-parchment-100 placeholder-ink-600 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition-colors shadow-inner"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-500 mb-2">اسم الشاعر <span className="text-crimson-400">*</span></label>
                <input
                  type="text"
                  required
                  value={poetName}
                  onChange={(e) => setPoetName(e.target.value)}
                  placeholder="مثال: أبو الطيب المتنبي"
                  className="w-full bg-charcoal-950 text-parchment-100 placeholder-ink-600 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition-colors shadow-inner"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-500 mb-2">العصر الأدبي</label>
                <select
                  value={era}
                  onChange={(e) => setEra(e.target.value as Era)}
                  className="w-full bg-charcoal-950 text-parchment-100 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition-colors shadow-inner cursor-pointer"
                >
                  {ERAS.map((e) => (
                    <option key={e} value={e}>العصر ال{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-500 mb-2">بحر القصيدة</label>
                <select
                  value={bahr}
                  onChange={(e) => setBahr(e.target.value as Bahr)}
                  className="w-full bg-charcoal-950 text-parchment-100 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition-colors shadow-inner cursor-pointer"
                >
                  {BUHOOR.map((b) => (
                    <option key={b} value={b}>بحر {b}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-ink-500 mb-2">القافية والرويّ</label>
                <input
                  type="text"
                  value={rhyme}
                  onChange={(e) => setRhyme(e.target.value)}
                  placeholder="مثال: الميم المضمومة (ـمُ)"
                  className="w-full bg-charcoal-950 text-parchment-100 placeholder-ink-600 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-700 transition-colors shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="bg-charcoal-850 rounded-3xl p-6 md:p-8 border border-white/5 shadow-md space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <h3 className="font-bold text-2xl text-parchment-100 font-heading">النص والأبيات</h3>
              <div className="flex items-center gap-3 text-sm text-ink-500 font-sans font-bold">
                <span>فاصل الشطرين:</span>
                <input
                  type="text"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="w-16 bg-charcoal-950 border border-white/10 rounded-lg px-2 py-1.5 text-center text-parchment-100 focus:outline-none focus:border-accent-700 shadow-inner"
                />
              </div>
            </div>
            
            <textarea
              rows={8}
              required
              value={versesRaw}
              onChange={(e) => setVersesRaw(e.target.value)}
              placeholder="واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ&#10;ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي ... وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ"
              className="w-full bg-charcoal-950 text-parchment-100 placeholder-ink-600 border border-white/5 rounded-2xl p-6 text-xl font-poetry leading-[2.4] focus:outline-none focus:border-accent-700 transition-colors shadow-inner resize-y"
            />
          </div>

          {/* Audio file selection */}
          <div className="p-8 rounded-3xl bg-charcoal-850/50 border border-dashed border-white/10 text-center hover:border-accent-700/50 transition-colors shadow-md">
            <div className="w-16 h-16 bg-charcoal-900 border border-white/5 flex items-center justify-center mx-auto mb-4 shadow-inner rounded-2xl">
               <Upload className="w-8 h-8 text-accent-700" />
            </div>
            <h4 className="text-xl font-bold text-parchment-100 mb-2 font-heading">
              إرفاق ملف صوتي للمحاذاة التلقائية
            </h4>
            <p className="text-xs text-ink-500 font-sans mb-6">(MP3, WAV, M4A, OGG)</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={handlePickAudio}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-parchment-100 border border-white/10 shadow-md text-sm font-bold font-sans flex items-center justify-center gap-2 transition-colors rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
              >
                <Music className="w-4 h-4 text-accent-700" />
                <span>{audioFileName ? `تم اختيار: ${audioFileName}` : "تصفح الملفات المحلية..."}</span>
              </button>
              
              {audioSourcePath && (
                <button
                  type="button"
                  onClick={handleStartTranscribe}
                  className="px-6 py-3 bg-accent-700 hover:bg-accent-600 text-charcoal-950 shadow-md shadow-accent-700/20 text-sm font-bold font-sans flex items-center justify-center gap-2 transition-all rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:ring-accent-700"
                >
                  <Mic className="w-4 h-4" />
                  <span>تفريغ الصوت الذكي (ASR)</span>
                </button>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={parsedVerses.length === 0 || !title.trim() || !poetName.trim() || isProcessing}
              className="px-8 py-3.5 bg-accent-700 hover:bg-accent-600 text-charcoal-950 disabled:opacity-50 font-bold text-sm font-sans shadow-lg shadow-accent-700/20 transition-all flex items-center justify-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-900 focus-visible:ring-accent-700 w-full sm:w-auto"
            >
              <Save className="w-5 h-5" />
              <span>{isProcessing ? "جاري المعالجة والحفظ..." : "حفظ القصيدة في الديوان"}</span>
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
