import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Poem } from '@/lib/types';

const STORAGE_KEY = 'diwan.mobile.poems.v1';

interface LibraryContextValue {
  poems: Poem[];
  isLoading: boolean;
  addPoem: (poem: Poem) => Promise<void>;
  removePoem: (id: string) => Promise<void>;
  getPoem: (id: string) => Poem | undefined;
  updatePoem: (id: string, updater: (poem: Poem) => Poem) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(
  undefined,
);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [poems, setPoems] = useState<Poem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Poem[];
            setPoems(parsed);
          } catch {
            setPoems([]);
          }
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: Poem[]) => {
    setPoems(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addPoem = useCallback(
    async (poem: Poem) => {
      await persist([poem, ...poems]);
    },
    [poems, persist],
  );

  const removePoem = useCallback(
    async (id: string) => {
      await persist(poems.filter((p) => p.id !== id));
    },
    [poems, persist],
  );

  const getPoem = useCallback(
    (id: string) => poems.find((p) => p.id === id),
    [poems],
  );

  const updatePoem = useCallback(
    async (id: string, updater: (poem: Poem) => Poem) => {
      const current = poems.find((p) => p.id === id);
      if (!current) return;
      const next = updater(current);
      await persist(poems.map((p) => (p.id === id ? next : p)));
    },
    [poems, persist],
  );

  const value = useMemo(
    () => ({ poems, isLoading, addPoem, removePoem, getPoem, updatePoem }),
    [poems, isLoading, addPoem, removePoem, getPoem, updatePoem],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
