import React from "react";
import {
  VideoStyle,
  VIDEO_FONTS,
  VIDEO_PALETTES,
  VIDEO_MOTIONS,
} from "./videoStyles";
import { Type, Palette, Move, TypeOutline, Baseline, Layout, MonitorPlay } from "lucide-react";

interface VideoStyleControlsProps {
  style: VideoStyle;
  onChange: (style: VideoStyle) => void;
  disabled: boolean;
}

export function VideoStyleControls({
  style,
  onChange,
  disabled,
}: VideoStyleControlsProps) {
  const updateStyle = (updates: Partial<VideoStyle>) => {
    onChange({ ...style, ...updates });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Font & Line Height */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Type className="w-4 h-4 text-ink-400" />
          <label className="text-xs font-bold text-ink-400">الخط والمسافات</label>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {VIDEO_FONTS.map((font) => (
            <button
              key={font.id}
              disabled={disabled}
              onClick={() => updateStyle({ font: font.id })}
              className={`p-2 rounded-xl text-center transition-all border ${
                style.font === font.id
                  ? "bg-accent-700/10 text-accent-500 border-accent-700/30"
                  : "bg-charcoal-950 text-ink-500 border-white/5 hover:bg-white/5"
              }`}
            >
              <span className="block text-sm font-bold mb-1" style={{ fontFamily: font.family.replace(/"/g, '') }}>
                {font.label}
              </span>
              <span className="block text-[9px] opacity-70">{font.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-2">
          <label className="flex justify-between text-xs font-bold text-ink-500 mb-2">
            <span>تباعد الأسطر</span>
            <span>{style.lineHeight.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="1.3"
            max="2.0"
            step="0.05"
            value={style.lineHeight}
            onChange={(e) => updateStyle({
              lineHeight: Math.min(2, Math.max(1.3, Number(e.target.value))),
            })}
            disabled={disabled}
            className="w-full accent-accent-700 h-2 bg-charcoal-950 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </section>

      {/* Palette */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-ink-400" />
          <label className="text-xs font-bold text-ink-400">الألوان</label>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {VIDEO_PALETTES.map((palette) => (
            <button
              key={palette.id}
              disabled={disabled}
              onClick={() => updateStyle({ palette: palette.id })}
              className={`p-2 rounded-xl flex items-center gap-3 transition-all border ${
                style.palette === palette.id
                  ? "bg-accent-700/10 border-accent-700/30"
                  : "bg-charcoal-950 border-white/5 hover:bg-white/5"
              }`}
            >
              <div 
                className="w-6 h-6 rounded-full border border-white/20 shadow-inner shrink-0" 
                style={{ background: `linear-gradient(135deg, ${palette.background} 0%, ${palette.secondary} 100%)` }}
              >
                <div className="w-full h-full rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: palette.accent }}></div>
                </div>
              </div>
              <span className={`text-xs font-bold ${style.palette === palette.id ? 'text-accent-500' : 'text-ink-300'}`}>
                {palette.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Motion */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Move className="w-4 h-4 text-ink-400" />
          <label className="text-xs font-bold text-ink-400">حركة النص</label>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {VIDEO_MOTIONS.map((motion) => (
            <button
              key={motion.id}
              disabled={disabled}
              onClick={() => updateStyle({ motion: motion.id })}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                style.motion === motion.id
                  ? "bg-accent-700/10 text-accent-500 border-accent-700/30"
                  : "bg-charcoal-950 text-ink-500 border-white/5 hover:bg-white/5"
              }`}
            >
              {motion.label}
            </button>
          ))}
        </div>
      </section>

      {/* Overlays & Signature */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <Layout className="w-4 h-4 text-ink-400" />
          <label className="text-xs font-bold text-ink-400">العناصر الإضافية</label>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={style.showProgress}
            onChange={(e) => updateStyle({ showProgress: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 rounded bg-charcoal-950 border-white/10 text-accent-700 focus:ring-accent-700 focus:ring-offset-charcoal-900"
          />
          <span className="text-xs font-bold text-ink-300">إظهار شريط التقدم</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={style.safeArea}
            onChange={(e) => updateStyle({ safeArea: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 rounded bg-charcoal-950 border-white/10 text-accent-700 focus:ring-accent-700 focus:ring-offset-charcoal-900"
          />
          <span className="text-xs font-bold text-ink-300 flex-1">مراعاة الهوامش الآمنة</span>
        </label>

        <div>
          <label className="block text-xs font-bold text-ink-500 mb-2">توقيع (يظهر في الأسفل)</label>
          <input
            type="text"
            maxLength={40}
            value={style.signature}
            onChange={(e) => updateStyle({ signature: e.target.value })}
            disabled={disabled}
            placeholder="مثال: @my_account"
            className="w-full bg-charcoal-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-parchment-100 placeholder:text-ink-600 focus:border-accent-700 focus:outline-none"
            dir="auto"
          />
        </div>
      </section>
    </div>
  );
}
