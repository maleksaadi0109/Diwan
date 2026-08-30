import React, { useState } from "react";
import { Type, Cpu, ShieldCheck, Activity, CheckCircle2, AlertCircle } from "lucide-react";
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
    <div className="h-full overflow-y-auto px-4 md:px-12 py-8 md:py-10 max-w-4xl mx-auto w-full select-none space-y-10 animate-fade-in scroll-smooth pb-24 md:pb-12">
      <div className="border-b border-white/5 pb-6">
        <h2 className="text-4xl md:text-5xl font-bold text-parchment-100 font-heading">
          إعدادات ديوان
        </h2>
        <p className="text-sm text-ink-500 mt-3 font-sans">
          تخصيص الخطوط والتشغيل ومعالج الصوتيات والذكاء الاصطناعي
        </p>
      </div>

      {/* Typography settings */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <Type className="w-5 h-5" />
          <span>الخطوط والطباعة الشعرية</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              حجم خط أبيات الشعر ({poetryFontSize})
            </label>
            <div className="flex items-center gap-2 bg-charcoal-900 p-1.5 border border-white/5 rounded-2xl shadow-inner">
              {["20px", "24px", "28px", "32px"].map((size) => (
                <button
                  key={size}
                  onClick={() => setPoetryFontSize(size)}
                  className={`flex-1 py-2 text-[14px] font-mono font-bold transition-all rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
                    poetryFontSize === size
                      ? "bg-accent-700 text-charcoal-950 border-accent-700 shadow-md shadow-accent-700/20"
                      : "bg-transparent text-ink-500 hover:text-parchment-100 hover:bg-white/5 border-transparent"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              التمرير التلقائي أثناء الاستماع
            </label>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`w-full py-3 px-5 text-[14px] font-bold transition-all flex items-center justify-between border shadow-sm rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 ${
                autoScroll
                  ? "bg-accent-700/10 text-accent-500 border-accent-700/20"
                  : "bg-charcoal-900 text-ink-500 border-white/5 hover:bg-charcoal-800 hover:text-parchment-100"
              }`}
            >
              <span>متابعة البيت النشط تلقائياً</span>
              <span className={autoScroll ? "text-accent-500 font-bold" : "text-ink-600 font-bold"}>
                {autoScroll ? "مفعل" : "معطل"}
              </span>
            </button>
          </div>
        </div>

        {/* Sample text preview */}
        <div className="mt-8 p-6 md:p-8 bg-charcoal-900 border border-white/5 text-center shadow-inner relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-accent-700" />
          <p
            className="font-poetry text-parchment-100 font-bold transition-all duration-300 leading-[2.4]"
            style={{ fontSize: poetryFontSize }}
          >
            الخَيلُ وَاللَيلُ وَالبَيداءُ تَعرِفُني ... وَالسَيفُ وَالرُمحُ وَالقِرطاسُ وَالقَلَمُ
          </p>
        </div>
      </section>

      {/* AI Speech Engine settings */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <Cpu className="w-5 h-5" />
          <span>محرك التعرف على الصوت والمحاذاة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              نموذج Whisper المعتمد
            </label>
            <select
              value={asrModel}
              onChange={(e) => setAsrModel(e.target.value)}
              className="w-full bg-charcoal-900 text-parchment-100 border border-white/5 rounded-2xl px-4 py-3 text-[14px] font-bold focus:outline-none focus:border-accent-700 transition-colors shadow-inner cursor-pointer"
            >
              <option value="tiny">Tiny (أسرع - دقة أساسية)</option>
              <option value="base">Base (سريع - دقة متوسطة)</option>
              <option value="small">Small (موصى به للتطوير والاستخدام العادي)</option>
              <option value="medium">Medium (دقة عالية)</option>
              <option value="large-v3">Large-v3 (أعلى دقة تشكيل)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-ink-500 mb-3">
              جهاز المعالجة (Compute Device)
            </label>
            <select
              value={computeDevice}
              onChange={(e) => setComputeDevice(e.target.value)}
              className="w-full bg-charcoal-900 text-parchment-100 border border-white/5 rounded-2xl px-4 py-3 text-[14px] font-bold focus:outline-none focus:border-accent-700 transition-colors shadow-inner cursor-pointer"
            >
              <option value="cpu">معالج النظام (CPU - float32 / int8)</option>
              <option value="cuda">بطاقة الرسوميات (NVIDIA CUDA - float16)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Python Worker Diagnostics */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
            <Activity className="w-5 h-5" />
            <span>فحص صحة معالج الصوتيات</span>
          </div>
          <button
            onClick={handleCheckHealth}
            disabled={isCheckingHealth}
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-parchment-100 border border-white/10 text-[14px] font-bold transition-colors flex items-center justify-center gap-2 font-sans shadow-sm rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
          >
            <span>{isCheckingHealth ? "جاري الفحص..." : "تشغيل فحص الصحة"}</span>
          </button>
        </div>

        {healthStatus && (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 text-[14px] space-y-4 select-text font-sans shadow-sm rounded-2xl">
            <div className="flex items-center gap-3 text-emerald-400 font-bold">
              <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
              <span>معالج بايثون متصل وجاهز للعمل</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-emerald-400/80 pt-4 border-t border-emerald-500/20 font-mono text-xs md:text-[13px] font-bold">
              <div>إصدار المعالج: <span className="text-emerald-300">{healthStatus.worker_version}</span></div>
              <div>إصدار بايثون: <span className="text-emerald-300">{healthStatus.python_version}</span></div>
              <div className="col-span-2 truncate">
                FFmpeg: <span className="text-emerald-300">{healthStatus.ffmpeg}</span>
              </div>
            </div>
          </div>
        )}

        {healthError && (
          <div className="p-5 bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 text-[14px] flex items-center gap-3 font-sans font-bold shadow-sm rounded-2xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{healthError}</span>
          </div>
        )}
      </section>

      {/* System diagnostics & privacy */}
      <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-5 shadow-md">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <ShieldCheck className="w-5 h-5" />
          <span>الخصوصية والعمل دون اتصال</span>
        </div>
        <p className="text-[15px] text-ink-500 leading-relaxed font-sans font-medium">
          يعمل ديوان بنسبة 100% محلياً على جهازك دون إرسال أي تسجيلات أو نصوص إلى خوادم سحابية خارجية.
          جميع قواعد البيانات والصوتيات محفوظة في مجلد التطبيق الآمن.
        </p>

        <div className="pt-5 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs md:text-[13px] text-ink-600 font-sans font-bold">
          <span>نظام التشغيل: Linux (Fedora)</span>
          <span className="font-mono ltr-num text-ink-700">Tauri v2.x | React 18</span>
        </div>
      </section>
    </div>
  );
};
