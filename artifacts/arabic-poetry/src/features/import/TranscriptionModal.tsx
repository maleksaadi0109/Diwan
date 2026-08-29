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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none animate-fadeIn text-[#F8F9FA]">
      <div className="bg-[#13161D] border border-white/[0.08] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] backdrop-blur-2xl">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#F3E19C] shadow-[0_0_12px_rgba(212,175,55,0.2)]">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#F8F9FA] font-poetry tracking-wide flex items-center gap-2">
                <span>التفريغ الصوتي الذكي (Arabic ASR)</span>
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              </h3>
              <p className="text-xs text-[#A0AAB7] font-sans mt-0.5">
                استخراج الكلمات العربية بدقة وحساب طوابعها الزمنية عبر Whisper
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#A0AAB7] hover:text-[#F8F9FA] hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isTranscribing && (
            <div className="space-y-4 py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#F3E19C] mx-auto animate-pulse shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <Mic className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#F8F9FA]">
                  {stageMessage || "جاري معالجة الصوت وتحليله بالذكاء الاصطناعي..."}
                </h4>
                <p className="text-xs text-[#A0AAB7] mt-1 font-sans">
                  في المرة الأولى، قد يستغرق تنزيل وتحميل أوزان النموذج بضع دقائق.
                </p>
              </div>
              <div className="w-full max-w-md mx-auto bg-black/40 rounded-full h-2.5 overflow-hidden border border-white/10 p-0.5 shadow-inner">
                <div
                  className="bg-gradient-to-r from-[#B89225] via-[#D4AF37] to-[#F3E19C] h-full transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                  style={{ width: `${Math.max(5, Math.min(100, progress * 100))}%` }}
                />
              </div>
              <p className="text-xs font-mono text-[#F3E19C] ltr-num font-bold">
                {Math.round(progress * 100)}%
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2.5 shadow-inner">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isTranscribing && transcript && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>اكتمل التفريغ: تم استخراج {toArabicDigits(transcript.words.length)} كلمة بدقة عالية</span>
                </div>
                <span className="font-mono ltr-num text-xs font-bold text-emerald-200">
                  {formatTime(transcript.duration_ms)}
                </span>
              </div>

              {/* Full Text */}
              <div className="bg-black/30 p-5 rounded-2xl border border-white/[0.08] space-y-2">
                <span className="text-xs font-semibold text-[#D4AF37] block">النص المفرّغ:</span>
                <p className="font-poetry text-base text-[#F8F9FA] leading-[2] select-text">
                  {transcript.raw_text}
                </p>
              </div>

              {/* Words timestamp breakdown preview */}
              <div className="bg-black/30 p-5 rounded-2xl border border-white/[0.08] space-y-2">
                <span className="text-xs font-semibold text-[#D4AF37] block">طوابع الكلمات (عينة):</span>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
                  {transcript.words.slice(0, 20).map((w, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs flex items-center gap-2 hover:border-[#D4AF37]/30 transition-colors"
                    >
                      <span className="font-poetry font-bold text-[#FFF5DC]">{w.word}</span>
                      <span className="text-[11px] font-mono text-[#F3E19C] ltr-num">
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
        <div className="px-6 py-4 border-t border-white/[0.08] bg-black/20 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-[#CED4DA] text-xs font-medium border border-white/10 transition-colors"
          >
            إغلاق
          </button>
          {!isTranscribing && transcript && onApplyTranscript && (
            <button
              onClick={() => onApplyTranscript(transcript)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] text-[#0A0C10] text-xs font-bold transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              اعتماد التفريغ الصوتي
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
