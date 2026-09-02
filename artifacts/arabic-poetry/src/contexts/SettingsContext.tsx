import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * App-wide reading typography settings, persisted to localStorage so they
 * survive restarts -- mirrors the lazy-init + immediate-persist pattern used
 * by AudioPlayerContext (closeToTray/mediaSessionEnabled) and the
 * presentation font-scale key in FocusModeView.
 */

const POETRY_FONT_SIZE_KEY = "diwan-poetry-font-size";
export const MIN_POETRY_FONT_SIZE = 20;
export const MAX_POETRY_FONT_SIZE = 56;
const DEFAULT_POETRY_FONT_SIZE = 30;

function readPersistedFontSize(): number {
  if (typeof window === "undefined") return DEFAULT_POETRY_FONT_SIZE;
  const raw = window.localStorage.getItem(POETRY_FONT_SIZE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_POETRY_FONT_SIZE;
  return Math.min(MAX_POETRY_FONT_SIZE, Math.max(MIN_POETRY_FONT_SIZE, parsed));
}

interface SettingsContextValue {
  poetryFontSize: number;
  setPoetryFontSize: (size: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [poetryFontSize, setPoetryFontSizeState] = useState<number>(readPersistedFontSize);

  const setPoetryFontSize = useCallback((size: number) => {
    const clamped = Math.min(MAX_POETRY_FONT_SIZE, Math.max(MIN_POETRY_FONT_SIZE, Math.round(size)));
    setPoetryFontSizeState(clamped);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(POETRY_FONT_SIZE_KEY, String(clamped));
    }
  }, []);

  const value = useMemo(
    () => ({ poetryFontSize, setPoetryFontSize }),
    [poetryFontSize, setPoetryFontSize]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within a SettingsProvider");
  return ctx;
}
