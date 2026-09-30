import React from "react";
import { AspectRatio, BackgroundType, VideoTemplate } from "./types";
import { VideoStyle } from "./videoStyles";
import { Sparkles } from "lucide-react";

export interface VideoPreset {
  id: string;
  label: string;
  description: string;
  template: VideoTemplate;
  aspectRatio: AspectRatio;
  backgroundType: BackgroundType;
  styleOverrides: Partial<VideoStyle>;
}

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: "reel-minimal",
    label: "ريلز حديث",
    description: "بسيط، خط القاهرة، داكن",
    template: "minimalist",
    aspectRatio: "9:16",
    backgroundType: "solid",
    styleOverrides: {
      font: "cairo",
      palette: "midnight",
      motion: "fade",
      safeArea: true,
      showProgress: true,
    }
  },
  {
    id: "story-classic",
    label: "قصة كلاسيكية",
    description: "أنيق، خط أميري، ذهبي",
    template: "classic",
    aspectRatio: "9:16",
    backgroundType: "gradient",
    styleOverrides: {
      font: "amiri",
      palette: "gold",
      motion: "rise",
      safeArea: true,
      showProgress: true,
    }
  },
  {
    id: "dramatic",
    label: "دراما عميقة",
    description: "سينمائي، خط شهرزاد، أخضر",
    template: "cinematic",
    aspectRatio: "9:16",
    backgroundType: "particles",
    styleOverrides: {
      font: "scheherazade",
      palette: "emerald",
      motion: "zoom",
      safeArea: true,
      showProgress: false,
    }
  }
];

interface VideoStylePresetsProps {
  onSelect: (preset: VideoPreset) => void;
  disabled: boolean;
}

export function VideoStylePresets({ onSelect, disabled }: VideoStylePresetsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-accent-500" />
        <label className="text-xs font-bold text-accent-400">مظاهر جاهزة بضغطة واحدة</label>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {VIDEO_PRESETS.map(preset => (
          <button
            key={preset.id}
            disabled={disabled}
            onClick={() => onSelect(preset)}
            className="flex flex-col items-start p-3 rounded-xl border border-white/5 bg-charcoal-950 hover:bg-white/5 hover:border-white/10 transition-all text-right group"
          >
            <span className="text-sm font-bold text-parchment-100 group-hover:text-accent-400 transition-colors">
              {preset.label}
            </span>
            <span className="text-[10px] text-ink-500 mt-1">
              {preset.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
