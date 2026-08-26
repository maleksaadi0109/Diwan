import React, { useState } from "react";
import { Era, Bahr, Poem } from "@/types";
import { normalizeArabic } from "@/lib/utils";
import { Upload, FileText, CheckCircle, Music } from "lucide-react";
import { pickAudioFile, copyAudioToAppData } from "@/lib/audio/fileManager";

interface ImportViewProps {
  onImportPoem: (poem: Poem) => void;
}

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
        verses: parsedVerses.map((v, i) => ({
          ...v,
          poemId,
          // Generate synthetic initial timestamps if audio is attached
          alignment: savedAudioPath
            ? {
                id: `align-${poemId}-${i + 1}`,
                verseId: v.id,
                recordingId: recId,
                startMs: i * 8000,
                endMs: (i + 1) * 8000,
                confidence: 0.85,
                status: "auto",
              }
            : undefined,
        })),
        recordings: savedAudioPath
          ? [
              {
                id: recId,
                poemId,
                title: audioFileName || "تسجيل صوتي",
                reciter: poetName.trim(),
                audioPath: savedAudioPath,
                durationMs: parsedVerses.length * 8000,
                createdAt: new Date().toISOString().split("T")[0],
              },
            ]
          : [],
        tags: ["مستورد يدوياً"],
      };

      onImportPoem(newPoem);
      setSuccessMessage("تم حفظ القصيدة وإدراج التسجيل الصوتي بنجاح في ديوان!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6 max-w-5xl mx-auto w-full select-none">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-parchment-100 font-poetry">
          استيراد قصيدة وتسجيل صوتي
        </h2>
        <p className="text-sm text-parchment-400 mt-1">
          أدخل أبيات القصيدة مع الفاصل بين الشطرين واربطها بالتسجيل الصوتي المحلي.
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 select-text">
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
              className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
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
              className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-parchment-300 mb-1.5">
              العصر الأدبي
            </label>
            <select
              value={era}
              onChange={(e) => setEra(e.target.value as Era)}
              className="w-full bg-charcoal-850 text-parchment-100 border border-charcoal-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
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
              className="w-full bg-charcoal-850 text-parchment-100 border border-charcoal-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
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
              className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/50 border border-charcoal-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-500"
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
            rows={8}
            required
            value={versesRaw}
            onChange={(e) => setVersesRaw(e.target.value)}
            placeholder="واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ ... وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ
ما لي أُكَتِّمُ حُبّاً قَد بَرى جَسَدي ... وَتَدَّعي حُبَّ سَيفِ الدَولَةِ الأُمَمُ"
            className="w-full bg-charcoal-850 text-parchment-100 placeholder-parchment-400/40 border border-charcoal-700 rounded-xl p-4 text-sm font-poetry leading-relaxed focus:outline-none focus:border-gold-500 font-normal"
          />
        </div>

        {/* Audio file upload selection */}
        <div className="p-6 rounded-2xl bg-charcoal-900 border border-dashed border-charcoal-700 text-center hover:border-gold-500/50 transition-colors">
          <Upload className="w-8 h-8 text-gold-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-parchment-200 mb-1">
            إرفاق ملف صوتي للقصيدة (MP3, WAV, M4A, OGG, FLAC)
          </h4>
          <p className="text-xs text-parchment-400 mb-3">
            سيتم استيراد الملف ونسخه بأمان إلى مجلد التطبيق للمحاذاة والمزامنة الدقيقة.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handlePickAudio}
              className="px-5 py-2.5 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 text-gold-400 border border-charcoal-700 text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <Music className="w-4 h-4" />
              <span>{audioFileName ? `تم اختيار: ${audioFileName}` : "اختيار ملف صوتي محلي..."}</span>
            </button>
            {audioFileName && (
              <button
                type="button"
                onClick={() => {
                  setAudioFileName(null);
                  setAudioSourcePath(null);
                }}
                className="text-xs text-parchment-400 hover:text-rose-400"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>

        {/* Live Preview */}
        {parsedVerses.length > 0 && (
          <div className="bg-charcoal-900 p-5 rounded-2xl border border-charcoal-800">
            <h4 className="text-xs font-semibold text-gold-400 mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>معاينة الأبيات ({parsedVerses.length} بيت)</span>
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {parsedVerses.slice(0, 3).map((v) => (
                <div
                  key={v.id}
                  className="bg-charcoal-950/60 p-2.5 rounded-lg border border-charcoal-850 text-xs font-poetry text-parchment-200 flex justify-between gap-4"
                >
                  <span className="flex-1 text-right">{v.firstHemistich}</span>
                  <span className="text-gold-500/40 font-sans">...</span>
                  <span className="flex-1 text-left">{v.secondHemistich}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={parsedVerses.length === 0 || !title.trim() || !poetName.trim() || isProcessing}
            className="px-6 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed text-charcoal-950 font-bold text-sm transition-all shadow-md flex items-center gap-2"
          >
            {isProcessing ? "جاري الحفظ..." : "حفظ القصيدة في المكتبة"}
          </button>
        </div>
      </form>
    </div>
  );
};
