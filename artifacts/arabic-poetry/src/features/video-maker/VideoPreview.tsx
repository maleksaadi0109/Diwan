import React, { useRef, useEffect, useState } from "react";
import { Maximize2, Play, Pause } from "lucide-react";
import { VideoState } from "./types";
import { useVideoRenderer } from "./useVideoRenderer";
import { resolveAudioSrcAsync } from "@/lib/audio/fileManager";

interface VideoPreviewProps {
  state: VideoState;
  exportTimeMsRef: React.MutableRefObject<number | null>;
  isExporting: boolean;
  exportProgress: number;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ 
  state, 
  exportTimeMsRef, 
  isExporting,
  exportProgress 
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
        
        const audio = new Audio(src);
        audio.crossOrigin = "anonymous";
        
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

  return (
    <div className="flex-1 min-w-0 min-h-0 bg-charcoal-950 flex flex-col relative overflow-hidden">
      <div 
        ref={containerRef}
        className="flex-1 min-h-0 min-w-0 flex items-center justify-center relative p-4 overflow-hidden"
        style={{
          backgroundColor: '#0a0b0e' // charcol-950
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="video-preview-canvas"
          width={canvasWidth}
          height={canvasHeight}
          className={`shadow-2xl object-contain bg-black ${
            is169 ? "w-full h-auto max-h-full" : "h-full w-auto max-w-full"
          }`}
          style={{
            aspectRatio: is169 ? '16/9' : '9/16'
          }}
        />
        
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

        <button
          onClick={handleFullscreen}
          className="p-2 rounded-xl text-ink-500 hover:text-parchment-100 hover:bg-white/5 transition-colors"
          title="ملء الشاشة"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
