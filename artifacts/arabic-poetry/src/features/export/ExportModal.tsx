import React, { useState } from "react";
import { Poem } from "@/types";
import {
  exportLrc,
  exportSrt,
  exportDiwanJson,
  downloadFile,
} from "@/lib/export/exportManager";
import { Download, FileText, Music, CheckCircle2, X } from "lucide-react";

interface ExportModalProps {
  poem: Poem;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  poem,
  isOpen,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<"lrc" | "srt" | "json">("lrc");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    const cleanTitle = poem.title.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");

    if (selectedFormat === "lrc") {
      const content = exportLrc(poem);
      downloadFile(content, `${cleanTitle}.lrc`, "text/plain");
    } else if (selectedFormat === "srt") {
      const content = exportSrt(poem);
      downloadFile(content, `${cleanTitle}.srt`, "text/plain");
    } else if (selectedFormat === "json") {
      const content = exportDiwanJson(poem);
      downloadFile(content, `${cleanTitle}_diwan.json`, "application/json");
    }

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1500);
  };

  const getPreview = () => {
    if (selectedFormat === "lrc") return exportLrc(poem);
    if (selectedFormat === "srt") return exportSrt(poem);
    return exportDiwanJson(poem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-100/75 backdrop-blur-sm p-4 select-none animate-fadeIn">
      <div className="bg-sand-50 border border-sand-300 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-sand-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-crimson-700">
            <Download className="w-5 h-5" />
            <div>
              <h3 className="text-sm font-bold font-poetry text-ink-900">
                تصدير القصيدة والكلمات المتزامنة
              </h3>
              <p className="text-xs text-ink-600">
                تصدير بتنسيقات LRC و SRT و Diwan JSON
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-600 hover:text-ink-800 p-1 rounded-lg hover:bg-sand-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Format selection cards */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSelectedFormat("lrc")}
              className={`p-3 rounded-xl border text-center transition-all ${
                selectedFormat === "lrc"
                  ? "bg-crimson-800/15 border-crimson-800/40 text-crimson-600 shadow-sm"
                  : "bg-white border-sand-300 text-ink-600 hover:text-ink-800"
              }`}
            >
              <Music className="w-5 h-5 mx-auto mb-1.5" />
              <div className="text-xs font-bold font-mono">LRC</div>
              <div className="text-[10px] opacity-75">كلمات متزامنة</div>
            </button>

            <button
              onClick={() => setSelectedFormat("srt")}
              className={`p-3 rounded-xl border text-center transition-all ${
                selectedFormat === "srt"
                  ? "bg-crimson-800/15 border-crimson-800/40 text-crimson-600 shadow-sm"
                  : "bg-white border-sand-300 text-ink-600 hover:text-ink-800"
              }`}
            >
              <FileText className="w-5 h-5 mx-auto mb-1.5" />
              <div className="text-xs font-bold font-mono">SRT</div>
              <div className="text-[10px] opacity-75">ترجمة وتسميات</div>
            </button>

            <button
              onClick={() => setSelectedFormat("json")}
              className={`p-3 rounded-xl border text-center transition-all ${
                selectedFormat === "json"
                  ? "bg-crimson-800/15 border-crimson-800/40 text-crimson-600 shadow-sm"
                  : "bg-white border-sand-300 text-ink-600 hover:text-ink-800"
              }`}
            >
              <Download className="w-5 h-5 mx-auto mb-1.5" />
              <div className="text-xs font-bold font-mono">JSON</div>
              <div className="text-[10px] opacity-75">حزمة ديوان الشاملة</div>
            </button>
          </div>

          {/* Code Preview */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-ink-700 block">
              معاينة الملف المصدّر:
            </span>
            <pre className="p-3 bg-sand-100 rounded-xl border border-sand-300 font-mono text-[11px] text-ink-800 max-h-48 overflow-y-auto leading-relaxed select-text ltr-num text-left">
              {getPreview()}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-sand-300 bg-white/50 flex items-center justify-between">
          <div>
            {downloadSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم تنزيل الملف بنجاح!</span>
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-sand-200 hover:bg-sand-300 text-ink-700 text-xs font-medium border border-sand-400 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleExport}
              className="px-5 py-2 rounded-xl bg-crimson-800 hover:bg-crimson-700 text-sand-50 text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>تنزيل الملف</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
