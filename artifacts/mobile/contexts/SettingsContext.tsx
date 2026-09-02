import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'diwan.mobile.settings.v1';

export const MIN_FONT_SIZE = 18;
export const MAX_FONT_SIZE = 40;
const DEFAULT_FONT_SIZE = 24;

interface SettingsContextValue {
  fontSize: number;
  setFontSize: (size: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState(DEFAULT_FONT_SIZE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { fontSize?: number };
        if (
          typeof parsed.fontSize === 'number' &&
          parsed.fontSize >= MIN_FONT_SIZE &&
          parsed.fontSize <= MAX_FONT_SIZE
        ) {
          setFontSizeState(parsed.fontSize);
        }
      } catch {
        // ignore corrupt settings
      }
    });
  }, []);

  const setFontSize = useCallback((size: number) => {
    const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    setFontSizeState(clamped);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize: clamped }));
  }, []);

  const value = useMemo(
    () => ({ fontSize, setFontSize }),
    [fontSize, setFontSize],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
