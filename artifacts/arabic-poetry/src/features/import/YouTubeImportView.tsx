import React, { useState } from "react";
import {
  fetchYoutubeVideoInfo,
  downloadYoutubeAudio,
  cancelYoutubeDownload,
  WorkerYouTubeInfoData,
  WorkerYouTubeDownloadData,
} from "@/lib/worker/workerClient";
import { getPoemRecordingDirectory, resolveAudioSrc, resolveAudioSrcAsync } from "@/lib/audio/fileManager";
import { formatTime } from "@/lib/utils";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Download,
  Clock,
  User,
  Sparkles,
  FileAudio,
  Copy,
  Check,
  Volume2,
  FolderCheck,
  KeyRound,
} from "lucide-react";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";

interface YouTubeImportViewProps {
  onAudioDownloaded?: (result: WorkerYouTubeDownloadData, videoInfo: WorkerYouTubeInfoData) => void;
}

const ERROR_MAP: Record<string, string> = {
  YTDLP_NOT_INSTALLED: "مكوّن تنزيل YouTube غير مثبت في النظام.",
  FFMPEG_NOT_FOUND: "برنامج FFmpeg غير متوفر أو لم يتم العثور على مساره.",
  VIDEO_UNAVAILABLE: "المقطع غير متاح أو تم حذفه.",
  PRIVATE_VIDEO: "المقطع خاص ولا يمكن تنزيله.",
  LOGIN_REQUIRED: "يتطلب هذا المقطع تسجيل الدخول. أدخل بيانات تسجيل الدخول (كوكيز) من متصفحك أدناه للمتابعة.",
  COOKIES_INVALID: "بيانات تسجيل الدخول (الكوكيز) غير صالحة أو منتهية الصلاحية. يرجى الحصول على كوكيز جديدة والمحاولة مجددًا.",
  LIVE_STREAM_NOT_SUPPORTED: "تنزيل البث المباشر غير مدعوم.",
  NO_AUDIO_FORMAT: "لم يتم العثور على مسار صوتي مناسب.",
  DOWNLOAD_FAILED: "فشل تنزيل الصوت. يرجى التأكد من اتصال الإنترنت وصلاحية الرابط.",
  CONVERSION_FAILED: "تم تنزيل الملف، لكن تحويله إلى MP3 فشل.",
  OUTPUT_MISSING: "انتهت عملية التنزيل دون إنشاء ملف صوتي.",
  NETWORK_TIMEOUT: "انتهت مهلة الاتصال أثناء تنزيل الصوت.",
  FILESYSTEM_ERROR: "تعذر حفظ الصوت في مجلد التطبيق.",
};

const COOKIE_UNLOCK_CODES = new Set(["LOGIN_REQUIRED", "COOKIES_INVALID"]);

/** Reads the leading `CODE: message` prefix that workerClient attaches to
 * YouTube worker errors. Falls back to substring scanning for callers that
 * threw a plain Arabic message without the prefix. */
function extractErrorCode(err: unknown): string | null {
  const msg = (err as Error)?.message || String(err || "");
  const prefixMatch = msg.match(/^([A-Z_]+):/);
  if (prefixMatch && prefixMatch[1] in ERROR_MAP) {
    return prefixMatch[1];
  }
  for (const code of Object.keys(ERROR_MAP)) {
    if (msg.includes(code)) return code;
  }
  return null;
}

function formatErrorMessage(err: unknown): string {
  if (!err) return "فشلت عملية تنزيل الصوت";
  const msg = (err as Error).message || String(err);
  const code = extractErrorCode(err);
  if (code) return ERROR_MAP[code];
  // Strip a leading "CODE: " prefix even for unmapped codes so raw text stays clean
  return msg.replace(/^[A-Z_]+:\s*/, "");
}

export const YouTubeImportView: React.FC<YouTubeImportViewProps> = ({ onAudioDownloaded }) => {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<WorkerYouTubeInfoData | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Download state
  const [audioQuality, setAudioQuality] = useState<"128k" | "192k">("192k");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<WorkerYouTubeDownloadData | null>(null);
  const [playableAudioSrc, setPlayableAudioSrc] = useState<string>("");
  const [copiedPath, setCopiedPath] = useState(false);

  // Cookie-based login unlock (for age-restricted / login-required videos)
  const [needsCookies, setNeedsCookies] = useState(false);
  const [cookiesText, setCookiesText] = useState("");
  const [showCookieHelp, setShowCookieHelp] = useState(false);

  const handleFetchInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoadingInfo(true);
    setInfoError(null);
    setVideoInfo(null);
    setDownloadResult(null);
    setPlayableAudioSrc("");
    setDownloadError(null);

    try {
      const info = await fetchYoutubeVideoInfo(url.trim(), 3600, needsCookies ? cookiesText.trim() : undefined);
      setVideoInfo(info);
      setNeedsCookies(false);
    } catch (err: unknown) {
      const code = extractErrorCode(err);
      if (code && COOKIE_UNLOCK_CODES.has(code)) {
        setNeedsCookies(true);
      }
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
    setPlayableAudioSrc("");
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
        jobId,
        needsCookies ? cookiesText.trim() : undefined
      );

      setDownloadProgress(1.0);
      const removedMs = res.leading_silence_removed_ms || 0;
      setDownloadStage(
        removedMs > 0
          ? `اكتمل التنزيل بنجاح! حُذف ${removedMs} مللي ثانية من الصمت التمهيدي.`
          : "اكتمل التنزيل وتحويل الصوت إلى MP3 بنجاح!"
      );
      setDownloadResult(res);
      setNeedsCookies(false);

      if (res.playback_audio_path) {
        const streamUrl = await resolveAudioSrcAsync(res.playback_audio_path);
        setPlayableAudioSrc(streamUrl);
      }

      if (onAudioDownloaded) {
        onAudioDownloaded(res, videoInfo);
      }
    } catch (err: unknown) {
      const code = extractErrorCode(err);
      if (code && COOKIE_UNLOCK_CODES.has(code)) {
        setNeedsCookies(true);
      }
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

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2500);
  };

  return (
    <div className="p-8 bg-charcoal-850 border border-white/5 rounded-3xl space-y-6 select-none shadow-2xl backdrop-blur-xl text-parchment-100">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-6">
        <div className="w-12 h-12 rounded-2xl bg-crimson-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
          <YoutubeIcon className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-parchment-100 font-poetry tracking-wide flex items-center gap-2">
            <span>استيراد تسجيل صوتي من YouTube</span>
            <Sparkles className="w-4 h-4 text-accent-700" />
          </h3>
          <p className="text-xs text-ink-500 mt-1 font-sans">
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
            className="w-full bg-charcoal-900 text-parchment-100 placeholder-ink-500 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent-700/60 transition-all ltr-num shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || isLoadingInfo || isDownloading}
          className="px-6 py-3.5 rounded-2xl bg-accent-700 from-accent-700 to-accent-600 hover:bg-accent-600  disabled:opacity-40 text-charcoal-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-accent-700/20 cursor-pointer"
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

      {/* Cookie-based login unlock (shown after a LOGIN_REQUIRED / COOKIES_INVALID error) */}
      {needsCookies && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3 select-text shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              <span>هذا المقطع يتطلب تسجيل الدخول</span>
            </span>
            <button
              type="button"
              onClick={() => setShowCookieHelp((v) => !v)}
              className="text-xs text-amber-300/80 hover:text-amber-200 underline underline-offset-2 cursor-pointer"
            >
              كيف أحصل على الكوكيز؟
            </button>
          </div>

          {showCookieHelp && (
            <ol className="text-[11px] text-ink-500 leading-relaxed list-decimal list-inside space-y-1 bg-charcoal-950/60 p-3 rounded-xl border border-white/5">
              <li>سجّل الدخول إلى حسابك في YouTube داخل متصفحك.</li>
              <li>
                استخدم إضافة متصفح مثل "Get cookies.txt LOCALLY" لتصدير كوكيز موقع youtube.com بصيغة Netscape.
              </li>
              <li>الصق محتوى الملف بالكامل في الحقل أدناه ثم أعد المحاولة.</li>
            </ol>
          )}

          <textarea
            value={cookiesText}
            onChange={(e) => setCookiesText(e.target.value)}
            placeholder="# Netscape HTTP Cookie File&#10;.youtube.com  TRUE  /  TRUE  ...  "
            dir="ltr"
            rows={4}
            className="w-full bg-charcoal-950/80 text-parchment-100 placeholder-ink-500/60 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-accent-700/60 transition-all shadow-inner resize-y"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-ink-500/80">
              تُستخدم الكوكيز محليًا لهذه العملية فقط ولا يتم تخزينها.
            </p>
            <button
              type="button"
              onClick={() => (downloadError && videoInfo ? handleStartDownload() : handleFetchInfo())}
              disabled={!cookiesText.trim() || isLoadingInfo || isDownloading}
              className="shrink-0 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-500/40 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isLoadingInfo || isDownloading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )}
              <span>إعادة المحاولة بتسجيل الدخول</span>
            </button>
          </div>
        </div>
      )}

      {/* Video Preview Card */}
      {videoInfo && (
        <div className="p-6 bg-charcoal-950/40 rounded-3xl border border-white/5 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300 select-text">
          <div className="flex flex-col sm:flex-row gap-5">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="w-full sm:w-48 h-32 object-cover rounded-2xl border border-white/10 shadow-lg shrink-0"
              />
            )}
            <div className="flex-1 space-y-2">
              <h4 className="font-poetry text-lg md:text-xl font-bold text-parchment-100 leading-snug">
                {videoInfo.title}
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-xl border border-white/5">
                  <User className="w-3.5 h-3.5 text-accent-700" />
                  <span>{videoInfo.channel}</span>
                </span>
                <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-xl border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-accent-700" />
                  <span className="font-mono ltr-num">{formatTime(videoInfo.duration_ms)}</span>
                </span>
              </div>
              {videoInfo.description && (
                <p className="text-xs text-ink-500 line-clamp-2 leading-relaxed pt-1">
                  {videoInfo.description}
                </p>
              )}
            </div>
          </div>

          {/* Download Options */}
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Audio Quality Selector */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-ink-500 font-medium">جودة الصوت:</span>
              <div className="flex gap-1 bg-charcoal-900 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setAudioQuality("192k")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    audioQuality === "192k"
                      ? "bg-accent-700 text-charcoal-950 shadow-md shadow-accent-700/20"
                      : "text-ink-500 hover:text-parchment-100"
                  }`}
                >
                  عالية (192 kbps)
                </button>
                <button
                  type="button"
                  onClick={() => setAudioQuality("128k")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    audioQuality === "128k"
                      ? "bg-accent-700 text-charcoal-950 shadow-md shadow-accent-700/20"
                      : "text-ink-500 hover:text-parchment-100"
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
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-accent-700 from-accent-700 to-accent-600 hover:bg-accent-600  text-charcoal-950 font-bold text-xs shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
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
            <div className="p-5 rounded-2xl bg-charcoal-900 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-accent-500">{downloadStage}</span>
                <span className="font-mono text-accent-700 ltr-num font-bold">
                  {Math.round(downloadProgress * 100)}%
                </span>
              </div>
              <div className="w-full bg-charcoal-950/40 rounded-full h-2 overflow-hidden p-0.5 border border-white/10 shadow-inner">
                <div
                  className="bg-accent-700 from-accent-600 via-accent-700 to-accent-500 h-full transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                  style={{ width: `${Math.max(5, Math.min(100, downloadProgress * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Download Success Card with Exact File Path & Direct Player */}
          {downloadResult && !isDownloading && (
            <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-emerald-300 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>تم تنزيل ومعالجة الصوت بنجاح!</span>
                </div>
                <span className="text-xs text-emerald-400/80 font-mono ltr-num">
                  {formatTime(downloadResult.duration_ms)}
                </span>
              </div>

              {/* Exact File Location on Disk */}
              <div className="bg-charcoal-950/80 p-4 rounded-2xl border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-500 font-semibold flex items-center gap-2">
                    <FolderCheck className="w-4 h-4 text-accent-700" />
                    <span>موقع حفظ الملف الصوتي على جهازك:</span>
                  </span>
                  <button
                    onClick={() => handleCopyPath(downloadResult.playback_audio_path)}
                    className="flex items-center gap-1.5 text-xs text-accent-700 hover:text-accent-500 bg-white/5 hover:bg-white/10 px-3 py-1 rounded-xl border border-white/10 transition-colors cursor-pointer"
                    title="نسخ المسار الكامل للملف"
                  >
                    {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPath ? "تم النسخ!" : "نسخ المسار"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-emerald-200/90 bg-black/60 p-2.5 rounded-xl border border-white/5 break-all select-all ltr-num">
                  {downloadResult.playback_audio_path}
                </div>
              </div>

              {/* Instant Audio Audition Player */}
              <div className="bg-charcoal-950/80 p-4 rounded-2xl border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <Volume2 className="w-4 h-4 text-accent-700" />
                  <span>معاينة الاستماع الفوري:</span>
                </div>
                <audio
                  controls
                  src={playableAudioSrc || resolveAudioSrc(downloadResult.playback_audio_path)}
                  className="w-full sm:w-80 h-9 rounded-xl outline-none"
                />
              </div>
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
