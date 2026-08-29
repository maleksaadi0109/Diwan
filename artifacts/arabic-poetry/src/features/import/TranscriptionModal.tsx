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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4 select-none animate-fadeIn text-ink-900">
      <div className="bg-paper-100 border-2 border-paper-400 rounded-none w-full max-w-2xl overflow-hidden shadow-lg flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-paper-400 flex items-center justify-between bg-paper-200">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-paper-300 border border-paper-500 flex items-center justify-center text-accent-700 shadow-sm rounded-none">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-ink-900 font-heading flex items-center gap-2">
                <span>التفريغ الصوتي الذكي (Arabic ASR)</span>
              </h3>
              <p className="text-[13px] text-ink-600 font-ui font-bold mt-1">
                استخراج الكلمات العربية بدقة وحساب طوابعها الزمنية عبر Whisper
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-none text-ink-600 hover:text-ink-900 hover:bg-paper-300 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isTranscribing && (
            <div className="space-y-6 py-10 text-center">
              <div className="w-16 h-16 bg-paper-200 border border-paper-400 flex items-center justify-center text-accent-700 mx-auto animate-pulse shadow-sm rounded-none">
                <Mic className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h4 className="text-[16px] font-bold text-ink-900 font-ui">
                  {stageMessage || "جاري معالجة الصوت وتحليله بالذكاء الاصطناعي..."}
                </h4>
                <p className="text-[13px] text-ink-600 mt-2 font-ui font-bold">
                  في المرة الأولى، قد يستغرق تنزيل وتحميل أوزان النموذج بضع دقائق.
                </p>
              </div>
              <div className="w-full max-w-md mx-auto bg-paper-300 h-3 border border-paper-400 p-0.5 shadow-inner rounded-none">
                <div
                  className="bg-accent-700 h-full transition-all duration-300 rounded-none shadow-sm"
                  style={{ width: `${Math.max(5, Math.min(100, progress * 100))}%` }}
                />
              </div>
              <p className="text-[14px] font-mono text-ink-800 ltr-num font-bold">
                {Math.round(progress * 100)}%
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-5 bg-red-50 border border-red-800 text-red-800 text-[14px] flex items-center gap-3 shadow-sm rounded-none font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isTranscribing && transcript && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-800 text-green-800 text-[14px] shadow-sm rounded-none font-bold font-ui">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                  <span>اكتمل التفريغ: تم استخراج {toArabicDigits(transcript.words.length)} كلمة بدقة عالية</span>
                </div>
                <span className="font-mono ltr-num text-[14px]">
                  {formatTime(transcript.duration_ms)}
                </span>
              </div>

              {/* Full Text */}
              <div className="bg-paper-200 p-6 border border-paper-400 rounded-none shadow-sm space-y-3">
                <span className="text-[14px] font-bold text-accent-700 block font-ui">النص المفرّغ:</span>
                <p className="font-poetry text-xl text-ink-900 leading-[2.4] select-text">
                  {transcript.raw_text}
                </p>
              </div>

              {/* Words timestamp breakdown preview */}
              <div className="bg-paper-200 p-6 border border-paper-400 rounded-none shadow-sm space-y-4">
                <span className="text-[14px] font-bold text-accent-700 block font-ui">طوابع الكلمات (عينة):</span>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-1 pb-2 pr-2">
                  {transcript.words.slice(0, 20).map((w, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 bg-paper-100 border border-paper-400 rounded-none text-[13px] flex items-center gap-3 hover:border-accent-700 transition-colors shadow-sm"
                    >
                      <span className="font-poetry font-bold text-ink-900">{w.word}</span>
                      <span className="text-[12px] font-mono text-ink-600 font-bold ltr-num">
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
        <div className="px-6 py-4 border-t border-paper-400 bg-paper-200 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-transparent hover:bg-paper-300 text-ink-800 text-[14px] font-bold border border-paper-500 transition-colors rounded-none font-ui"
          >
            إغلاق
          </button>
          {!isTranscribing && transcript && onApplyTranscript && (
            <button
              onClick={() => onApplyTranscript(transcript)}
              className="px-8 py-2.5 bg-accent-700 hover:bg-accent-600 text-paper-100 text-[14px] font-bold transition-colors shadow-sm border border-accent-700 rounded-none font-ui"
            >
              اعتماد التفريغ الصوتي
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
