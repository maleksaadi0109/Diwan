import React, { useState } from "react";
import { Era, Bahr, Poem } from "@/types";
import { normalizeArabic } from "@/lib/utils";
import { Upload, CheckCircle, Music, Mic, Wand2, Globe, Edit3, Save, Sparkles, BookMarked } from "lucide-react";
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
import { AdabWorldImportView } from "./AdabWorldImportView";
import { YouTubeImportView } from "./YouTubeImportView";
import { NewPoemWizard } from "./NewPoemWizard";

interface ImportViewProps {
  onImportPoem: (poem: Poem) => void;
}

type ImportTab = "wizard" | "mizan" | "adabworld" | "youtube" | "manual";

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
    <div className="h-full overflow-y-auto px-8 md:px-12 py-10 max-w-6xl mx-auto w-full select-none scroll-smooth text-ink-900">
      {/* Top Header with Navigation Tabs */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-paper-400">
        <div>
          <h2 className="text-5xl font-bold text-ink-900 font-heading">
            استيراد القصائد والتسجيلات
          </h2>
          <p className="text-[16px] text-ink-600 mt-3 font-ui font-medium">
            استيراد النصوص المحققة والتسجيلات الصوتية عبر معالج ذكي متكامل
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-paper-200 p-1 rounded-none border border-paper-400 shrink-0 shadow-sm">
          <button
            onClick={() => setActiveTab("wizard")}
            className={`px-4 py-2 text-[14px] font-bold font-ui transition-colors flex items-center gap-2 ${
              activeTab === "wizard"
                ? "bg-accent-700 text-paper-100 border border-accent-700"
                : "bg-transparent text-ink-700 hover:bg-paper-300 hover:text-ink-900 border border-transparent"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span>المعالج الشامل</span>
          </button>
          <button
            onClick={() => setActiveTab("mizan")}
            className={`px-4 py-2 text-[14px] font-bold font-ui transition-colors flex items-center gap-2 ${
              activeTab === "mizan"
                ? "bg-accent-700 text-paper-100 border border-accent-700"
                : "bg-transparent text-ink-700 hover:bg-paper-300 hover:text-ink-900 border border-transparent"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>ميزان العرب</span>
          </button>
          <button
            onClick={() => setActiveTab("adabworld")}
            className={`px-4 py-2 text-[14px] font-bold font-ui transition-colors flex items-center gap-2 ${
              activeTab === "adabworld"
                ? "bg-accent-700 text-paper-100 border border-accent-700"
                : "bg-transparent text-ink-700 hover:bg-paper-300 hover:text-ink-900 border border-transparent"
            }`}
          >
            <BookMarked className="w-4 h-4" />
            <span>عالَم الأدب</span>
          </button>
          <button
            onClick={() => setActiveTab("youtube")}
            className={`px-4 py-2 text-[14px] font-bold font-ui transition-colors flex items-center gap-2 ${
              activeTab === "youtube"
                ? "bg-accent-700 text-paper-100 border border-accent-700"
                : "bg-transparent text-ink-700 hover:bg-paper-300 hover:text-ink-900 border border-transparent"
            }`}
          >
            <YoutubeIcon className="w-4 h-4" />
            <span>YouTube</span>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2 text-[14px] font-bold font-ui transition-colors flex items-center gap-2 ${
              activeTab === "manual"
                ? "bg-accent-700 text-paper-100 border border-accent-700"
                : "bg-transparent text-ink-700 hover:bg-paper-300 hover:text-ink-900 border border-transparent"
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

      {/* Tab 2b: Adab World */}
      {activeTab === "adabworld" && <AdabWorldImportView onPoemImported={onImportPoem} />}

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
        <form onSubmit={handleSave} className="space-y-8 select-text animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-10">
          {successMessage && (
            <div className="p-5 bg-green-50 border border-green-800 text-green-800 flex items-center gap-3 font-ui font-bold shadow-sm rounded-none">
              <CheckCircle className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="bg-paper-100 rounded-none p-8 border border-paper-400 shadow-sm space-y-6">
            <h3 className="font-bold text-3xl text-ink-900 border-b border-paper-400 pb-4 font-heading">معلومات القصيدة الأساسية</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-ui">
              <div>
                <label className="block text-[14px] font-bold text-ink-800 mb-2">عنوان القصيدة <span className="text-accent-700">*</span></label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: واحر قلباه ممن قلبه شبم"
                  className="w-full bg-paper-200 text-ink-900 placeholder-ink-500 border border-paper-400 rounded-none px-4 py-3 text-[15px] focus:outline-none focus:border-accent-700 transition-colors shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[14px] font-bold text-ink-800 mb-2">اسم الشاعر <span className="text-accent-700">*</span></label>
                <input
                  type="text"
                  required
                  value={poetName}
                  onChange={(e) => setPoetName(e.target.value)}
                  placeholder="مثال: أبو الطيب المتنبي"
                  className="w-full bg-paper-200 text-ink-900 placeholder-ink-500 border border-paper-400 rounded-none px-4 py-3 text-[15px] focus:outline-none focus:border-accent-700 transition-colors shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[14px] font-bold text-ink-800 mb-2">العصر الأدبي</label>
                <select
                  value={era}
                  onChange={(e) => setEra(e.target.value as Era)}
                  className="w-full bg-paper-200 text-ink-900 border border-paper-400 rounded-none px-4 py-3 text-[15px] focus:outline-none focus:border-accent-700 transition-colors shadow-sm cursor-pointer"
                >
                  {ERAS.map((e) => (
                    <option key={e} value={e}>العصر ال{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[14px] font-bold text-ink-800 mb-2">بحر القصيدة</label>
                <select
                  value={bahr}
                  onChange={(e) => setBahr(e.target.value as Bahr)}
                  className="w-full bg-paper-200 text-ink-900 border border-paper-400 rounded-none px-4 py-3 text-[15px] focus:outline-none focus:border-accent-700 transition-colors shadow-sm cursor-pointer"
                >
                  {BUHOOR.map((b) => (
                    <option key={b} value={b}>بحر {b}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[14px] font-bold text-ink-800 mb-2">القافية والرويّ</label>
                <input
                  type="text"
                  value={rhyme}
                  onChange={(e) => setRhyme(e.target.value)}
                  placeholder="مثال: الميم المضمومة (ـمُ)"
                  className="w-full bg-paper-200 text-ink-900 placeholder-ink-500 border border-paper-400 rounded-none px-4 py-3 text-[15px] focus:outline-none focus:border-accent-700 transition-colors shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-paper-100 rounded-none p-8 border border-paper-400 shadow-sm space-y-6">
             <div className="flex items-center justify-between border-b border-paper-400 pb-4">
              <h3 className="font-bold text-3xl text-ink-900 font-heading">النص والأبيات</h3>
              <div className="flex items-center gap-3 text-[14px] text-ink-800 font-ui font-bold">
                <span>فاصل الشطرين:</span>
                <input
                  type="text"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="w-16 bg-paper-200 border border-paper-400 rounded-none px-2 py-1 text-center text-ink-900 focus:outline-none focus:border-accent-700"
                />
              </div>
            </div>
            
            <textarea
              rows={8}
              required
              value={versesRaw}
              onChange={(e) => setVersesRaw(e.target.value)}
              placeholder="واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ&#10;ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي ... وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ"
              className="w-full bg-paper-200 text-ink-900 placeholder-ink-500 border border-paper-400 rounded-none p-6 text-[22px] font-poetry leading-[2.4] focus:outline-none focus:border-accent-700 transition-colors shadow-sm resize-y"
            />
          </div>

          {/* Audio file selection */}
          <div className="p-8 rounded-none bg-paper-200 border-2 border-dashed border-paper-400 text-center hover:border-accent-700 transition-colors shadow-sm">
            <div className="w-16 h-16 bg-paper-100 border border-paper-400 flex items-center justify-center mx-auto mb-4 shadow-sm rounded-none">
               <Upload className="w-8 h-8 text-accent-700" />
            </div>
            <h4 className="text-2xl font-bold text-ink-900 mb-2 font-heading">
              إرفاق ملف صوتي محلي للمحاذاة
            </h4>
            <p className="text-[14px] text-ink-600 font-ui font-bold mb-6">(MP3, WAV, M4A, OGG)</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={handlePickAudio}
                className="px-6 py-3 bg-paper-100 hover:bg-paper-300 text-ink-800 border border-paper-500 shadow-sm text-[14px] font-bold font-ui flex items-center gap-2 transition-colors rounded-none"
              >
                <Music className="w-4 h-4 text-ink-700" />
                <span>{audioFileName ? `تم اختيار: ${audioFileName}` : "تصفح الملفات المحلية..."}</span>
              </button>
              
              {audioSourcePath && (
                <button
                  type="button"
                  onClick={handleStartTranscribe}
                  className="px-6 py-3 bg-accent-700 hover:bg-accent-600 text-paper-100 border border-accent-700 shadow-sm text-[14px] font-bold font-ui flex items-center gap-2 transition-colors rounded-none"
                >
                  <Mic className="w-4 h-4" />
                  <span>بدء التفريغ الصوتي (ASR)</span>
                </button>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-8 border-t-2 border-paper-400">
            <button
              type="submit"
              disabled={parsedVerses.length === 0 || !title.trim() || !poetName.trim() || isProcessing}
              className="px-10 py-4 bg-ink-900 hover:bg-ink-800 text-paper-100 border border-ink-900 disabled:opacity-50 font-bold text-[16px] font-ui shadow-sm transition-colors flex items-center gap-2 rounded-none"
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
