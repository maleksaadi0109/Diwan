import React, { useState } from "react";
import { Type, Cpu, ShieldCheck, Activity, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { checkWorkerHealth, WorkerHealthData } from "@/lib/worker/workerClient";

export const SettingsView: React.FC = () => {
  const [poetryFontSize, setPoetryFontSize] = useState("24px");
  const [asrModel, setAsrModel] = useState("small");
  const [computeDevice, setComputeDevice] = useState("cpu");
  const [autoScroll, setAutoScroll] = useState(true);

  const [healthStatus, setHealthStatus] = useState<WorkerHealthData | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    setHealthError(null);
    try {
      const data = await checkWorkerHealth();
      setHealthStatus(data);
    } catch (err: unknown) {
      const error = err as Error;
      setHealthError(error.message || "فشل الاتصال بمعالج الصوت");
    } finally {
      setIsCheckingHealth(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 md:px-12 py-10 max-w-4xl mx-auto w-full select-none space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 scroll-smooth text-[#F8F9FA]">
      <div className="border-b border-white/[0.08] pb-6">
        <h2 className="text-4xl md:text-5xl font-bold text-[#F8F9FA] font-poetry tracking-wide">
          إعدادات ديوان
        </h2>
        <p className="text-sm text-[#A0AAB7] mt-2 font-sans tracking-wide">
          تخصيص الخطوط والتشغيل ومعالج الصوتيات والذكاء الاصطناعي
        </p>
      </div>

      {/* Typography settings */}
      <section className="bg-[#13161D]/90 border border-white/[0.08] rounded-3xl p-8 space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 text-[#D4AF37] font-bold tracking-widest font-sans uppercase">
          <Type className="w-5 h-5" />
          <span>الخطوط والطباعة الشعرية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          <div>
            <label className="block text-sm font-bold text-[#CED4DA] mb-3">
              حجم خط أبيات الشعر ({poetryFontSize})
            </label>
            <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/[0.08]">
              {["20px", "24px", "28px", "32px"].map((size) => (
                <button
                  key={size}
                  onClick={() => setPoetryFontSize(size)}
                  className={`flex-1 py-2 rounded-xl text-sm font-mono transition-all duration-300 ${
                    poetryFontSize === size
                      ? "bg-[#D4AF37] text-[#0A0C10] shadow-[0_0_12px_rgba(212,175,55,0.4)] font-bold scale-100"
                      : "bg-transparent text-[#A0AAB7] hover:text-[#F8F9FA] hover:bg-white/[0.06]"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CED4DA] mb-3">
              التمرير التلقائي أثناء الاستماع
            </label>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`w-full py-3.5 px-4 rounded-2xl text-sm font-bold transition-all duration-300 flex items-center justify-between shadow-sm border ${
                autoScroll
                  ? "bg-[#D4AF37]/15 text-[#F3E19C] border-[#D4AF37]/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
                  : "bg-black/30 text-[#A0AAB7] border-white/[0.08] hover:bg-white/[0.06]"
              }`}
            >
              <span>متابعة البيت النشط تلقائياً</span>
              <span className={autoScroll ? "text-[#D4AF37] font-bold" : "text-[#6C7A8C] font-medium"}>
                {autoScroll ? "مفعل" : "معطل"}
              </span>
            </button>
          </div>
        </div>

        {/* Sample text preview */}
        <div className="mt-6 p-6 rounded-2xl bg-black/40 border border-white/[0.08] text-center shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-[#D4AF37] to-[#8C6D14]" />
          <p
            className="font-poetry text-[#FFF8E7] font-bold transition-all duration-300 leading-relaxed tracking-wide"
            style={{ fontSize: poetryFontSize }}
          >
            الخَيلُ وَاللَيلُ وَالبَيداءُ تَعرِفُني ... وَالسَيفُ وَالرُمحُ وَالقِرطاسُ وَالقَلَمُ
          </p>
        </div>
      </section>

      {/* AI Speech Engine settings */}
      <section className="bg-[#13161D]/90 border border-white/[0.08] rounded-3xl p-8 space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 text-[#D4AF37] font-bold tracking-widest font-sans uppercase">
          <Cpu className="w-5 h-5" />
          <span>محرك التعرف على الصوت والمحاذاة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          <div>
            <label className="block text-sm font-bold text-[#CED4DA] mb-3">
              نموذج Whisper المعتمد
            </label>
            <select
              value={asrModel}
              onChange={(e) => setAsrModel(e.target.value)}
              className="w-full bg-[#14171E] text-[#F8F9FA] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]/60 transition-all shadow-inner cursor-pointer"
            >
              <option value="tiny">Tiny (أسرع - دقة أساسية)</option>
              <option value="base">Base (سريع - دقة متوسطة)</option>
              <option value="small">Small (موصى به للتطوير والاستخدام العادي)</option>
              <option value="medium">Medium (دقة عالية)</option>
              <option value="large-v3">Large-v3 (أعلى دقة تشكيل)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#CED4DA] mb-3">
              جهاز المعالجة (Compute Device)
            </label>
            <select
              value={computeDevice}
              onChange={(e) => setComputeDevice(e.target.value)}
              className="w-full bg-[#14171E] text-[#F8F9FA] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37]/60 transition-all shadow-inner cursor-pointer"
            >
              <option value="cpu">معالج النظام (CPU - float32 / int8)</option>
              <option value="cuda">بطاقة الرسوميات (NVIDIA CUDA - float16)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Python Worker Diagnostics */}
      <section className="bg-[#13161D]/90 border border-white/[0.08] rounded-3xl p-8 space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#D4AF37] font-bold tracking-widest font-sans uppercase">
            <Activity className="w-5 h-5" />
            <span>فحص صحة معالج الصوتيات</span>
          </div>
          <button
            onClick={handleCheckHealth}
            disabled={isCheckingHealth}
            className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#F8F9FA] border border-white/15 text-sm font-bold transition-all flex items-center justify-center gap-2 font-sans shadow-sm"
          >
            <span>{isCheckingHealth ? "جاري الفحص..." : "تشغيل فحص الصحة"}</span>
          </button>
        </div>

        {healthStatus && (
          <div className="p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-sm space-y-4 select-text font-sans shadow-inner">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>معالج بايثون متصل وجاهز للعمل</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-emerald-300 pt-3 border-t border-emerald-500/20 font-mono text-[13px]">
              <div>إصدار المعالج: <strong className="text-emerald-200">{healthStatus.worker_version}</strong></div>
              <div>إصدار بايثون: <strong className="text-emerald-200">{healthStatus.python_version}</strong></div>
              <div className="col-span-2 text-emerald-300/80 truncate">
                FFmpeg: <span className="font-semibold text-emerald-200">{healthStatus.ffmpeg}</span>
              </div>
            </div>
          </div>
        )}

        {healthError && (
          <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-sm flex items-center gap-3 font-sans font-medium shadow-inner">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            <span>{healthError}</span>
          </div>
        )}
      </section>

      {/* System diagnostics & privacy */}
      <section className="bg-[#13161D]/90 border border-white/[0.08] rounded-3xl p-8 space-y-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 text-[#D4AF37] font-bold tracking-widest font-sans uppercase">
          <ShieldCheck className="w-5 h-5" />
          <span>الخصوصية والعمل دون اتصال</span>
        </div>
        <p className="text-[13px] text-[#A0AAB7] leading-relaxed font-sans">
          يعمل ديوان بنسبة 100% محلياً على جهازك دون إرسال أي تسجيلات أو نصوص إلى خوادم سحابية خارجية.
          جميع قواعد البيانات والصوتيات محفوظة في مجلد التطبيق الآمن.
        </p>

        <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#6C7A8C] font-sans tracking-wide">
          <span>نظام التشغيل: Linux (Fedora)</span>
          <span className="font-mono ltr-num font-bold text-[#D4AF37]/80">Tauri v2.x | React 18</span>
        </div>
      </section>
    </div>
  );
};
