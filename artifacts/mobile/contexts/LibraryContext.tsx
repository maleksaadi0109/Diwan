import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  removePoems: (ids: string[]) => Promise<void>;
  getPoem: (id: string) => Poem | undefined;
  updatePoem: (id: string, updater: (poem: Poem) => Poem) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(
  undefined,
);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [poems, setPoems] = useState<Poem[]>([]);
  const poemsRef = useRef<Poem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Poem[];
            poemsRef.current = parsed;
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
    poemsRef.current = next;
    setPoems(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updatePoems = useCallback(
    async (updater: (current: Poem[]) => Poem[]) => {
      const next = updater(poemsRef.current);
      await persist(next);
    },
    [persist],
  );

  const addPoem = useCallback(
    async (poem: Poem) => {
      await updatePoems((current) => [poem, ...current]);
    },
    [updatePoems],
  );

  const removePoem = useCallback(
    async (id: string) => {
      await updatePoems((current) => current.filter((p) => p.id !== id));
    },
    [updatePoems],
  );

  const removePoems = useCallback(
    async (ids: string[]) => {
      const idsToRemove = new Set(ids);
      await updatePoems((current) => current.filter((p) => !idsToRemove.has(p.id)));
    },
    [updatePoems],
  );

  const getPoem = useCallback(
    (id: string) => poems.find((p) => p.id === id),
    [poems],
  );

  const updatePoem = useCallback(
    async (id: string, updater: (poem: Poem) => Poem) => {
      await updatePoems((current) =>
        current.map((poem) => (poem.id === id ? updater(poem) : poem)),
      );
    },
    [updatePoems],
  );

  const value = useMemo(
    () => ({ poems, isLoading, addPoem, removePoem, removePoems, getPoem, updatePoem }),
    [poems, isLoading, addPoem, removePoem, removePoems, getPoem, updatePoem],
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
