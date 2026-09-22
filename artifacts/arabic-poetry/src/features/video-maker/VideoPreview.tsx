import React, { useRef, useEffect, useState } from "react";
import { Maximize2, Play, Pause, Layout } from "lucide-react";
import { VideoState } from "./types";
import { useVideoRenderer } from "./useVideoRenderer";
import { resolveAudioSrcAsync } from "@/lib/audio/fileManager";
import { RecitationGuide } from "./RecitationGuide";

interface VideoPreviewProps {
  state: VideoState;
  exportTimeMsRef: React.MutableRefObject<number | null>;
  isExporting: boolean;
  exportProgress: number;
  isVoiceRecording?: boolean;
  recitationWordCount?: number;
  recitationGuideMode?: "speech" | "unavailable";
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ 
  state, 
  exportTimeMsRef, 
  isExporting,
  exportProgress,
  isVoiceRecording = false,
  recitationWordCount = 0,
  recitationGuideMode = "unavailable",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Initialize audio for preview
  useEffect(() => {
    let active = true;
    
    const loadAudio = async () => {
      setAudioError(null);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      
      if (!state.recording) return;

      try {
        const src = await resolveAudioSrcAsync(state.recording.audioPath);
        if (!active) return;
        
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "metadata";
        audio.src = src;
        
        audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
        audio.onerror = () => {
          setAudioError("تعذر تشغيل هذا التسجيل. اختر تسجيلاً صوتياً صالحاً.");
          setIsPlaying(false);
        };
        audio.onended = () => {
          setIsPlaying(false);
          // Auto pause if preview reached end
        };
        audio.onplay = () => setIsPlaying(true);
        audio.onpause = () => setIsPlaying(false);
        
        audioRef.current = audio;
        audio.load();
      } catch (err) {
        console.error("Failed to load audio for preview", err);
        setAudioError("تعذر تجهيز هذا التسجيل للمعاينة.");
      }
    };

    loadAudio();

    return () => {
      active = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [state.recording]);

  // Handle preview play/pause
  const togglePlay = () => {
    if (isExporting) return;
    
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioRef.current.currentTime >= (state.recording?.durationMs || 0) / 1000) {
          audioRef.current.currentTime = 0;
        }
        audioRef.current.play().catch((error) => {
          console.error(error);
          setAudioError("تعذر تشغيل هذا التسجيل. اختر تسجيلاً صوتياً صالحاً.");
        });
      }
    }
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(err => {
        console.warn("Fullscreen API failed", err);
      });
    } else {
      document.exitFullscreen?.();
    }
  };

  // Render loop
  useVideoRenderer(canvasRef, state, audioRef.current, exportTimeMsRef, isPlaying || isExporting);

  const is169 = state.aspectRatio === '16:9';
  const canvasWidth = is169 ? 1920 : 1080;
  const canvasHeight = is169 ? 1080 : 1920;

  const [showSafeAreaOverlay, setShowSafeAreaOverlay] = useState(false);

  return (
    <div className="flex-1 min-w-0 min-h-0 bg-charcoal-950 flex flex-col relative overflow-hidden">
      <div 
        ref={containerRef}
        className="flex-1 min-h-0 min-w-0 flex items-center justify-center relative p-4 overflow-hidden"
        style={{
          backgroundColor: '#0a0b0e' // charcol-950
        }}
      >
        <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl" style={{ aspectRatio: is169 ? '16/9' : '9/16' }}>
          <canvas
            ref={canvasRef}
            data-testid="video-preview-canvas"
            width={canvasWidth}
            height={canvasHeight}
            className="w-full h-full object-contain bg-black"
          />

          {/* Safe Area Preview Overlay */}
          {showSafeAreaOverlay && state.style?.safeArea && (
            <div className="absolute inset-0 pointer-events-none z-20 border-[2px] border-dashed border-red-500/50">
              <div className="absolute top-[10%] bottom-[15%] left-[8%] right-[8%] border-[1px] border-solid border-red-400/50 bg-red-500/10 flex items-center justify-center">
                <span className="text-red-300/70 text-xs font-bold font-sans bg-black/50 px-2 py-1 rounded">
                  المنطقة الآمنة للمحتوى
                </span>
              </div>
            </div>
          )}
        </div>
        
        {isExporting && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-parchment-100 z-10">
            <div className="animate-pulse mb-4 text-accent-700 font-bold font-sans">
              جاري تصدير الفيديو...
            </div>
            <div className="w-64 h-2 bg-charcoal-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent-700 transition-all duration-200"
                style={{ width: `${Math.round(exportProgress * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-xs font-mono text-ink-500">
              {Math.round(exportProgress * 100)}%
            </div>
          </div>
        )}

        {isVoiceRecording && state.poem && (
          <RecitationGuide
            poem={state.poem}
            highlightedWordCount={recitationWordCount}
            mode={recitationGuideMode}
          />
        )}
      </div>

      {/* Preview Controls */}
      <div className="h-16 border-t border-white/5 bg-charcoal-900 px-6 flex items-center justify-between shrink-0">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-4 text-ink-500 text-sm font-mono ltr-num">
            {formatTime(currentTime)} / {formatTime((state.recording?.durationMs || 0) / 1000)}
          </div>
          {audioError && (
            <span className="text-[10px] text-crimson-500 font-ui" role="alert">
              {audioError}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={isExporting || !state.recording || Boolean(audioError)}
            className="w-10 h-10 rounded-full bg-accent-700 text-charcoal-950 flex items-center justify-center hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {state.style?.safeArea && (
            <button
              onClick={() => setShowSafeAreaOverlay(!showSafeAreaOverlay)}
              aria-pressed={showSafeAreaOverlay}
              aria-label={showSafeAreaOverlay ? "إخفاء دليل المنطقة الآمنة" : "إظهار دليل المنطقة الآمنة"}
              className={`p-2 rounded-xl text-ink-500 hover:text-parchment-100 hover:bg-white/5 transition-colors ${showSafeAreaOverlay ? 'text-accent-500 bg-accent-700/10' : ''}`}
              title={showSafeAreaOverlay ? "إخفاء الدليل البصري للمنطقة الآمنة" : "إظهار الدليل البصري للمنطقة الآمنة"}
            >
              <Layout className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleFullscreen}
            className="p-2 rounded-xl text-ink-500 hover:text-parchment-100 hover:bg-white/5 transition-colors"
            title="ملء الشاشة"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
