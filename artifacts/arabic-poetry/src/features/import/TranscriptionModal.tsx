import React from "react";
import { TranscriptResult } from "@/lib/worker/workerClient";
import { formatTime, toArabicDigits } from "@/lib/utils";
import { Mic, CheckCircle2, AlertCircle, X, Sparkles } from "lucide-react";

interface TranscriptionModalProps {
  isOpen: boolean;
  isTranscribing: boolean;
  progress: number;
  stageMessage: string;
  transcript: TranscriptResult | null;
  errorMessage: string | null;
  onClose: () => void;
  onApplyTranscript?: (transcript: TranscriptResult) => void;
}

export const TranscriptionModal: React.FC<TranscriptionModalProps> = ({
  isOpen,
  isTranscribing,
  progress,
  stageMessage,
  transcript,
  errorMessage,
  onClose,
  onApplyTranscript,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4 select-none animate-fadeIn text-parchment-100">
      <div className="bg-charcoal-850 border-2 border-white/5 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-charcoal-900">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-charcoal-800 border border-white/10 flex items-center justify-center text-accent-700 shadow-md rounded-2xl">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-parchment-100 font-heading flex items-center gap-2">
                <span>التفريغ الصوتي الذكي (Arabic ASR)</span>
              </h3>
              <p className="text-[13px] text-ink-500 font-ui font-bold mt-1">
                استخراج الكلمات العربية بدقة وحساب طوابعها الزمنية عبر Whisper
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-2xl text-ink-500 hover:text-parchment-100 hover:bg-charcoal-800 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isTranscribing && (
            <div className="space-y-6 py-10 text-center">
              <div className="w-16 h-16 bg-charcoal-900 border border-white/5 flex items-center justify-center text-accent-700 mx-auto animate-pulse shadow-md rounded-2xl">
                <Mic className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h4 className="text-[16px] font-bold text-parchment-100 font-ui">
                  {stageMessage || "جاري معالجة الصوت وتحليله بالذكاء الاصطناعي..."}
                </h4>
                <p className="text-[13px] text-ink-500 mt-2 font-ui font-bold">
                  في المرة الأولى، قد يستغرق تنزيل وتحميل أوزان النموذج بضع دقائق.
                </p>
              </div>
              <div className="w-full max-w-md mx-auto bg-charcoal-800 h-3 border border-white/5 p-0.5 shadow-inner rounded-2xl">
                <div
                  className="bg-accent-700 h-full transition-all duration-300 rounded-2xl shadow-md"
                  style={{ width: `${Math.max(5, Math.min(100, progress * 100))}%` }}
                />
              </div>
              <p className="text-[14px] font-mono text-parchment-100 ltr-num font-bold">
                {Math.round(progress * 100)}%
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-5 bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 text-[14px] flex items-center gap-3 shadow-md rounded-2xl font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isTranscribing && transcript && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[14px] shadow-md rounded-2xl font-bold font-ui">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                  <span>اكتمل التفريغ: تم استخراج {toArabicDigits(transcript.words.length)} كلمة بدقة عالية</span>
                </div>
                <span className="font-mono ltr-num text-[14px]">
                  {formatTime(transcript.duration_ms)}
                </span>
              </div>

              {/* Full Text */}
              <div className="bg-charcoal-900 p-6 border border-white/5 rounded-2xl shadow-md space-y-3">
                <span className="text-[14px] font-bold text-accent-700 block font-ui">النص المفرّغ:</span>
                <p className="font-poetry text-xl text-parchment-100 leading-[2.4] select-text">
                  {transcript.raw_text}
                </p>
              </div>

              {/* Words timestamp breakdown preview */}
              <div className="bg-charcoal-900 p-6 border border-white/5 rounded-2xl shadow-md space-y-4">
                <span className="text-[14px] font-bold text-accent-700 block font-ui">طوابع الكلمات (عينة):</span>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-1 pb-2 pr-2">
                  {transcript.words.slice(0, 20).map((w, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 bg-charcoal-850 border border-white/5 rounded-2xl text-[13px] flex items-center gap-3 hover:border-accent-700 transition-colors shadow-md"
                    >
                      <span className="font-poetry font-bold text-parchment-100">{w.word}</span>
                      <span className="text-[12px] font-mono text-ink-500 font-bold ltr-num">
                        {formatTime(w.start_ms, true)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-charcoal-900 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-transparent hover:bg-charcoal-800 text-parchment-100 text-[14px] font-bold border border-white/10 transition-colors rounded-2xl font-ui"
          >
            إغلاق
          </button>
          {!isTranscribing && transcript && onApplyTranscript && (
            <button
              onClick={() => onApplyTranscript(transcript)}
              className="px-8 py-2.5 bg-accent-700 hover:bg-accent-600 text-charcoal-950 text-[14px] font-bold transition-colors shadow-md border border-accent-700 rounded-2xl font-ui"
            >
              اعتماد التفريغ الصوتي
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
