import React, { useState } from "react";
import {
  fetchYoutubeVideoInfo,
  downloadYoutubeAudio,
  cancelYoutubeDownload,
  WorkerYouTubeInfoData,
  WorkerYouTubeDownloadData,
} from "@/lib/worker/workerClient";
import { getPoemRecordingDirectory } from "@/lib/audio/fileManager";
import { formatTime } from "@/lib/utils";
import { Search, CheckCircle2, AlertCircle, RefreshCw, X, Download, ShieldCheck, Clock, User, Sparkles } from "lucide-react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";

interface YouTubeImportViewProps {
  onAudioDownloaded?: (result: WorkerYouTubeDownloadData, videoInfo: WorkerYouTubeInfoData) => void;
}

const ERROR_MAP: Record<string, string> = {
  YTDLP_NOT_INSTALLED: "مكوّن تنزيل YouTube غير مثبت في النظام.",
  FFMPEG_NOT_FOUND: "برنامج FFmpeg غير متوفر أو لم يتم العثور على مساره.",
  VIDEO_UNAVAILABLE: "المقطع غير متاح أو تم حذفه.",
  PRIVATE_VIDEO: "المقطع خاص ولا يمكن تنزيله.",
  LOGIN_REQUIRED: "يتطلب هذا المقطع تسجيل الدخول، وهو غير مدعوم حاليًا.",
  LIVE_STREAM_NOT_SUPPORTED: "تنزيل البث المباشر غير مدعوم.",
  NO_AUDIO_FORMAT: "لم يتم العثور على مسار صوتي مناسب.",
  DOWNLOAD_FAILED: "فشل تنزيل الصوت. يرجى التأكد من اتصال الإنترنت وصلاحية الرابط.",
  CONVERSION_FAILED: "تم تنزيل الملف، لكن تحويله إلى MP3 فشل.",
  OUTPUT_MISSING: "انتهت عملية التنزيل دون إنشاء ملف صوتي.",
  NETWORK_TIMEOUT: "انتهت مهلة الاتصال أثناء تنزيل الصوت.",
  FILESYSTEM_ERROR: "تعذر حفظ الصوت في مجلد التطبيق.",
};

function formatErrorMessage(err: unknown): string {
  if (!err) return "فشلت عملية تنزيل الصوت";
  const msg = (err as Error).message || String(err);
  for (const [code, arabicText] of Object.entries(ERROR_MAP)) {
    if (msg.includes(code)) {
      return arabicText;
    }
  }
  return msg;
}

export const YouTubeImportView: React.FC<YouTubeImportViewProps> = ({ onAudioDownloaded }) => {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<WorkerYouTubeInfoData | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Download state
  const [isPermitted, setIsPermitted] = useState(true);
  const [audioQuality, setAudioQuality] = useState<"128k" | "192k">("192k");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<WorkerYouTubeDownloadData | null>(null);

  const handleFetchInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoadingInfo(true);
    setInfoError(null);
    setVideoInfo(null);
    setDownloadResult(null);
    setDownloadError(null);

    try {
      const info = await fetchYoutubeVideoInfo(url.trim());
      setVideoInfo(info);
    } catch (err: unknown) {
      setInfoError(formatErrorMessage(err));
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleStartDownload = async () => {
    if (!videoInfo) return;

    setIsDownloading(true);
    setDownloadProgress(0.1);
    setDownloadStage("جاري بدء التنزيل واستخراج الصوت بأعلى جودة...");
    setDownloadError(null);
    const jobId = `yt-${Date.now()}`;
    setCurrentJobId(jobId);

    try {
      const poemUuid = `poem-${Date.now()}`;
      const recUuid = `rec-${Date.now()}`;
      const targetDir = await getPoemRecordingDirectory(poemUuid, recUuid);

      setDownloadProgress(0.35);
      setDownloadStage("جاري تنزيل وتحويل المقطع الصوتي عبر yt-dlp و FFmpeg...");

      const res = await downloadYoutubeAudio(
        videoInfo.webpage_url,
        targetDir,
        audioQuality,
        jobId
      );

      setDownloadProgress(1.0);
      const removedMs = res.leading_silence_removed_ms || 0;
      setDownloadStage(
        removedMs > 0
          ? `اكتمل التنزيل بنجاح! حُذف ${removedMs} مللي ثانية من الصمت التمهيدي.`
          : "اكتمل التنزيل وتحويل الصوت إلى MP3 بنجاح!"
      );
      setDownloadResult(res);

      if (onAudioDownloaded) {
        onAudioDownloaded(res, videoInfo);
      }
    } catch (err: unknown) {
      setDownloadError(formatErrorMessage(err));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelDownload = async () => {
    if (currentJobId) {
      await cancelYoutubeDownload(currentJobId);
    }
    setIsDownloading(false);
    setDownloadStage("تم إلغاء التنزيل");
  };

  return (
    <div className="p-8 bg-[#13161D]/90 border border-white/[0.08] rounded-3xl space-y-6 select-none shadow-2xl backdrop-blur-xl text-[#F8F9FA]">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/[0.08] pb-6">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <YoutubeIcon className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#F8F9FA] font-poetry tracking-wide flex items-center gap-2">
            <span>استيراد تسجيل صوتي من YouTube</span>
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          </h3>
          <p className="text-xs text-[#A0AAB7] mt-1 font-sans">
            تنزيل التسجيلات الشعرية وتحويلها إلى MP3 للتشغيل و WAV 16kHz للمحاذاة التلقائية
          </p>
        </div>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleFetchInfo} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... أو https://youtu.be/..."
            className="w-full bg-[#14171E] text-[#F8F9FA] placeholder-[#6C7A8C] border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-[#D4AF37]/60 transition-all ltr-num shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || isLoadingInfo || isDownloading}
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] disabled:opacity-40 text-[#0A0C10] font-bold text-sm transition-all flex items-center justify-center gap-2 shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.3)] cursor-pointer"
        >
          {isLoadingInfo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span>قراءة بيانات المقطع</span>
        </button>
      </form>

      {/* Info Error */}
      {infoError && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-3 select-text shadow-inner">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{infoError}</span>
        </div>
      )}

      {/* Video Preview Card */}
      {videoInfo && (
        <div className="p-6 bg-black/40 rounded-3xl border border-white/[0.08] space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300 select-text">
          <div className="flex flex-col sm:flex-row gap-5">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-full sm:w-48 h-32 object-cover rounded-2xl border border-white/10 shadow-lg shrink-0"
              />
            )}
            <div className="flex-1 space-y-2">
              <h4 className="font-poetry text-lg md:text-xl font-bold text-[#F8F9FA] leading-snug">
                {videoInfo.title}
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#A0AAB7]">
                <span className="flex items-center gap-1.5 bg-white/[0.04] px-3 py-1 rounded-xl border border-white/5">
                  <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{videoInfo.channel}</span>
                </span>
                <span className="flex items-center gap-1.5 bg-white/[0.04] px-3 py-1 rounded-xl border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span className="font-mono ltr-num">{formatTime(videoInfo.duration_ms)}</span>
                </span>
              </div>
              {videoInfo.description && (
                <p className="text-xs text-[#A0AAB7] line-clamp-2 leading-relaxed pt-1">
                  {videoInfo.description}
                </p>
              )}
            </div>
          </div>

          {/* Download Options */}
          <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Audio Quality Selector */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#A0AAB7] font-medium">جودة الصوت:</span>
              <div className="flex gap-1 bg-[#14171E] p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setAudioQuality("192k")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    audioQuality === "192k"
                      ? "bg-[#D4AF37] text-[#0A0C10] shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                      : "text-[#A0AAB7] hover:text-[#F8F9FA]"
                  }`}
                >
                  عالية (192 kbps)
                </button>
                <button
                  type="button"
                  onClick={() => setAudioQuality("128k")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    audioQuality === "128k"
                      ? "bg-[#D4AF37] text-[#0A0C10] shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                      : "text-[#A0AAB7] hover:text-[#F8F9FA]"
                  }`}
                >
                  قياسية (128 kbps)
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {!isDownloading ? (
                <button
                  type="button"
                  onClick={handleStartDownload}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B89225] hover:from-[#E6C265] hover:to-[#C9A233] text-[#0A0C10] font-bold text-xs shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل التسجيل الصوتي</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelDownload}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>إلغاء التنزيل</span>
                </button>
              )}
            </div>
          </div>

          {/* Download Progress Bar */}
          {isDownloading && (
            <div className="p-5 rounded-2xl bg-[#14171E] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#F3E19C]">{downloadStage}</span>
                <span className="font-mono text-[#D4AF37] ltr-num font-bold">
                  {Math.round(downloadProgress * 100)}%
                </span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden p-0.5 border border-white/10 shadow-inner">
                <div
                  className="bg-gradient-to-r from-[#B89225] via-[#D4AF37] to-[#F3E19C] h-full transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                  style={{ width: `${Math.max(5, Math.min(100, downloadProgress * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Download Success */}
          {downloadResult && !isDownloading && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 shadow-inner font-sans font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{downloadStage || "تم تنزيل الصوت ومعالجته بنجاح!"}</span>
            </div>
          )}

          {/* Download Error */}
          {downloadError && (
            <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-3 select-text shadow-inner">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{downloadError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
