import React, { useState } from "react";
import { Activity, CheckCircle2, AlertCircle, FileAudio, HardDrive, Download, Loader2 } from "lucide-react";
import {
  DiagnosticsReport,
  collectDiagnosticsSnapshot,
  runAudioDecodeTest,
  runStorageTest,
  exportDiagnosticsReport,
} from "@/lib/diagnostics/diagnosticsReport";
import { pickAudioFile } from "@/lib/audio/fileManager";

type TestState<T> = { status: "idle" } | { status: "running" } | { status: "done"; result: T };

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="text-ink-500">{label}: </span>
      <span className="text-emerald-300 break-words">{value}</span>
    </div>
  );
}

export const DiagnosticsPanel: React.FC = () => {
  const [snapshot, setSnapshot] = useState<Omit<DiagnosticsReport, "audioDecodeTest" | "storageTest"> | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const [audioTest, setAudioTest] = useState<TestState<DiagnosticsReport["audioDecodeTest"]>>({ status: "idle" });
  const [storageTest, setStorageTest] = useState<TestState<DiagnosticsReport["storageTest"]>>({ status: "idle" });

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const handleRunSnapshot = async () => {
    setIsLoadingSnapshot(true);
    setSnapshotError(null);
    try {
      const data = await collectDiagnosticsSnapshot();
      setSnapshot(data);
    } catch (err: unknown) {
      const error = err as Error;
      setSnapshotError(error.message || "فشل جمع بيانات التشخيص");
    } finally {
      setIsLoadingSnapshot(false);
    }
  };

  const handleTestAudioDecoding = async (customFilePath?: string) => {
    setAudioTest({ status: "running" });
    const result = await runAudioDecodeTest(customFilePath);
    setAudioTest({ status: "done", result });
  };

  const handlePickAndTestAudioFile = async () => {
    const picked = await pickAudioFile();
    if (!picked) return;
    await handleTestAudioDecoding(picked.path);
  };

  const handleTestStorage = async () => {
    setStorageTest({ status: "running" });
    const result = await runStorageTest();
    setStorageTest({ status: "done", result });
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const base = snapshot || (await collectDiagnosticsSnapshot());
      const report: DiagnosticsReport = {
        ...base,
        audioDecodeTest: audioTest.status === "done" ? audioTest.result : undefined,
        storageTest: storageTest.status === "done" ? storageTest.result : undefined,
      };
      const result = await exportDiagnosticsReport(report);
      if (result.success) {
        setExportMessage({ kind: "success", text: "تم حفظ التقرير التشخيصي بنجاح" });
      } else if (result.error !== "cancelled") {
        setExportMessage({ kind: "error", text: result.error || "تعذر حفظ التقرير" });
      }
    } catch (err) {
      const error = err as Error;
      setExportMessage({ kind: "error", text: error.message || "تعذر حفظ التقرير" });
    } finally {
      setIsExporting(false);
    }
  };

  const worker = snapshot?.worker;

  return (
    <section className="bg-charcoal-850 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-accent-700 font-bold font-sans text-lg">
          <Activity className="w-5 h-5" />
          <span>تشخيص النظام</span>
        </div>
        <button
          onClick={handleRunSnapshot}
          disabled={isLoadingSnapshot}
          className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-parchment-100 border border-white/10 text-[14px] font-bold transition-colors flex items-center justify-center gap-2 font-sans shadow-sm rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-700"
        >
          {isLoadingSnapshot && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isLoadingSnapshot ? "جاري الفحص..." : "تشغيل فحص الصحة"}</span>
        </button>
      </div>

      <p className="text-xs text-ink-500 font-sans leading-relaxed -mt-2">
        يعرض هذا القسم إصدار التطبيق وحالة معالج الصوتيات وأدواته، ويتيح اختبار فك ترميز الصوت وصلاحيات التخزين، وتصدير تقرير كامل لمشاركته عند طلب الدعم الفني.
      </p>

      {snapshot && worker && (
        <div
          className={`p-6 border text-[14px] space-y-4 select-text font-sans shadow-sm rounded-2xl ${
            worker.ok ? "bg-emerald-500/10 border-emerald-500/20" : "bg-crimson-500/10 border-crimson-500/20"
          }`}
        >
          <div className={`flex items-center gap-3 font-bold ${worker.ok ? "text-emerald-400" : "text-crimson-400"}`}>
            {worker.ok ? <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} /> : <AlertCircle className="w-5 h-5" strokeWidth={2.5} />}
            <span>{worker.ok ? "معالج بايثون متصل وجاهز للعمل" : "تعذر الاتصال بمعالج الصوتيات"}</span>
          </div>

          {worker.ok && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-emerald-500/20 font-mono text-xs md:text-[13px] font-bold">
              <StatusRow label="إصدار التطبيق" value={snapshot.appVersion} />
              <StatusRow label="البيئة" value={snapshot.platform === "desktop" ? "تطبيق سطح المكتب" : "متصفح ويب"} />
              <StatusRow label="إصدار المعالج" value={worker.data.worker_version} />
              <StatusRow label="إصدار بايثون" value={worker.data.python_version} />
              {worker.data.python_executable && (
                <div className="sm:col-span-2">
                  <StatusRow label="مسار مفسّر بايثون" value={worker.data.python_executable} />
                </div>
              )}
              <div className="sm:col-span-2">
                <StatusRow label="FFmpeg" value={worker.data.ffmpeg} />
              </div>
              <div className="sm:col-span-2">
                <StatusRow label="FFprobe" value={worker.data.ffprobe} />
              </div>
              <StatusRow label="إصدار yt-dlp" value={worker.data.ytdlp_version || "غير متاح"} />
              {worker.data.ytdlp_path && (
                <div className="sm:col-span-2">
                  <StatusRow label="مسار yt-dlp" value={worker.data.ytdlp_path} />
                </div>
              )}
            </div>
          )}
          {!worker.ok && <p className="text-crimson-400/90 text-sm">{worker.error}</p>}
        </div>
      )}

      {snapshotError && (
        <div className="p-5 bg-crimson-500/10 border border-crimson-500/20 text-crimson-400 text-[14px] flex items-center gap-3 font-sans font-bold shadow-sm rounded-2xl">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{snapshotError}</span>
        </div>
      )}

      {/* Audio decode test */}
      <div className="p-5 bg-charcoal-900 border border-white/5 rounded-2xl space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-accent-500" />
            <h4 className="text-sm font-bold text-parchment-100">اختبار فك ترميز الصوت</h4>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleTestAudioDecoding()}
              disabled={audioTest.status === "running"}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-parchment-100 transition-colors flex items-center gap-2"
            >
              {audioTest.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>اختبار بملف نموذجي</span>
            </button>
            <button
              type="button"
              onClick={handlePickAndTestAudioFile}
              disabled={audioTest.status === "running"}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-parchment-100 transition-colors"
            >
              اختيار ملف...
            </button>
          </div>
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          يتحقق هذا الاختبار من قدرة التطبيق على فك ترميز الصوت فعلياً عبر معالج بايثون وFFmpeg.
        </p>
        {audioTest.status === "done" && audioTest.result && (
          <div
            className={`p-4 rounded-xl text-xs font-mono flex items-start gap-2 ${
              audioTest.result.success ? "bg-emerald-500/10 text-emerald-300" : "bg-crimson-500/10 text-crimson-400"
            }`}
          >
            {audioTest.result.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 min-w-0">
              <div className="truncate">الملف: {audioTest.result.filePath}</div>
              {audioTest.result.success ? (
                <div>
                  المدة: {audioTest.result.metadata.duration_seconds.toFixed(1)} ث، القنوات: {audioTest.result.metadata.channels}، معدل العينة: {audioTest.result.metadata.sample_rate} هرتز، الترميز: {audioTest.result.metadata.codec}
                </div>
              ) : (
                <div>{audioTest.result.error}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Storage permissions test */}
      <div className="p-5 bg-charcoal-900 border border-white/5 rounded-2xl space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-accent-500" />
            <h4 className="text-sm font-bold text-parchment-100">اختبار صلاحيات التخزين</h4>
          </div>
          <button
            type="button"
            onClick={handleTestStorage}
            disabled={storageTest.status === "running"}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-parchment-100 transition-colors flex items-center gap-2 shrink-0"
          >
            {storageTest.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>تشغيل الاختبار</span>
          </button>
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          يتحقق هذا الاختبار من قدرة التطبيق على إنشاء ملف وكتابته وقراءته وحذفه في مجلد بياناته.
        </p>
        {storageTest.status === "done" && storageTest.result && (
          <div
            className={`p-4 rounded-xl text-xs font-mono flex items-start gap-2 ${
              storageTest.result.success ? "bg-emerald-500/10 text-emerald-300" : "bg-crimson-500/10 text-crimson-400"
            }`}
          >
            {storageTest.result.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 min-w-0">
              <div className="truncate">المسار: {storageTest.result.path}</div>
              {!storageTest.result.success && <div>{storageTest.result.error}</div>}
              {storageTest.result.success && <div>تمت الكتابة والقراءة والحذف بنجاح</div>}
            </div>
          </div>
        )}
      </div>

      {/* Export report */}
      <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
        <p className="text-xs text-ink-500 leading-relaxed max-w-md">
          يحفظ ملفاً نصياً (JSON) يحتوي كل بيانات هذه الصفحة، لمشاركته عند طلب المساعدة الفنية.
        </p>
        <button
          type="button"
          onClick={handleExportReport}
          disabled={isExporting}
          className="px-6 py-2.5 bg-accent-700 hover:bg-accent-600 text-charcoal-950 text-[14px] font-bold transition-colors flex items-center justify-center gap-2 shadow-md shadow-accent-700/20 rounded-xl shrink-0 disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{isExporting ? "جاري التصدير..." : "تصدير تقرير تشخيصي"}</span>
        </button>
      </div>

      {exportMessage && (
        <div
          className={`p-4 text-[13px] flex items-center gap-3 font-sans font-bold shadow-sm rounded-2xl ${
            exportMessage.kind === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-crimson-500/10 border border-crimson-500/20 text-crimson-400"
          }`}
        >
          {exportMessage.kind === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{exportMessage.text}</span>
        </div>
      )}
    </section>
  );
};
