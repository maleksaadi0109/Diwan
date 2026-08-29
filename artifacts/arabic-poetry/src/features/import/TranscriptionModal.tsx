import React from "react";
import { TranscriptResult } from "@/lib/worker/workerClient";
import { formatTime, toArabicDigits } from "@/lib/utils";
import { Mic, CheckCircle2, AlertCircle, X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-100/80 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div className="bg-sand-50 border border-sand-300 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-sand-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-crimson-800/15 border border-crimson-800/30 flex items-center justify-center text-crimson-700">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-900 font-poetry">
                التفريغ الصوتي الذكي (Arabic ASR)
              </h3>
              <p className="text-xs text-ink-600">
                استخراج الكلمات العربية بدقة وحساب طوابعها الزمنية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-600 hover:text-ink-800 hover:bg-sand-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isTranscribing && (
            <div className="space-y-3 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-crimson-800/10 border border-crimson-800/30 flex items-center justify-center text-crimson-700 mx-auto animate-pulse">
                <Mic className="w-6 h-6 animate-bounce" />
              </div>
              <h4 className="text-sm font-semibold text-ink-900">
                {stageMessage || "جاري معالجة الصوت وتحليله بالذكاء الاصطناعي..."}
              </h4>
              <div className="w-full max-w-md mx-auto bg-sand-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-crimson-800 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, Math.min(100, progress * 100))}%` }}
                />
              </div>
              <p className="text-xs font-mono text-crimson-700/90 ltr-num">
                {Math.round(progress * 100)}%
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isTranscribing && transcript && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>اكتمل التفريغ: تم استخراج {toArabicDigits(transcript.words.length)} كلمة بدقة عالية</span>
                </div>
                <span className="font-mono ltr-num text-[11px]">
                  {formatTime(transcript.duration_ms)}
                </span>
              </div>

              {/* Full Text */}
              <div className="bg-sand-100 p-4 rounded-xl border border-sand-300 space-y-2">
                <span className="text-xs font-semibold text-crimson-700 block">النص المفرّغ:</span>
                <p className="font-poetry text-base text-ink-900 leading-relaxed select-text">
                  {transcript.raw_text}
                </p>
              </div>

              {/* Words timestamp breakdown preview */}
              <div className="bg-sand-100 p-4 rounded-xl border border-sand-300 space-y-2">
                <span className="text-xs font-semibold text-crimson-700 block">طوابع الكلمات (عينة):</span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                  {transcript.words.slice(0, 20).map((w, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 bg-white border border-sand-300 rounded-lg text-xs flex items-center gap-1.5"
                    >
                      <span className="font-poetry font-bold text-ink-900">{w.word}</span>
                      <span className="text-[10px] font-mono text-crimson-700/80 ltr-num">
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
        <div className="px-6 py-3 border-t border-sand-300 bg-white/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-sand-200 hover:bg-sand-300 text-ink-700 text-xs font-medium border border-sand-400 transition-colors"
          >
            إغلاق
          </button>
          {!isTranscribing && transcript && onApplyTranscript && (
            <button
              onClick={() => onApplyTranscript(transcript)}
              className="px-5 py-2 rounded-xl bg-crimson-800 hover:bg-crimson-700 text-sand-50 text-xs font-bold transition-all shadow-md"
            >
              اعتماد التفريغ الصوتي
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
