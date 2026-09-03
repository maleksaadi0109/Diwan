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
import { makeLocalId } from '@/lib/api';
import type { Playlist } from '@/lib/types';

const STORAGE_KEY = 'diwan.mobile.playlists.v1';

interface PlaylistsContextValue {
  playlists: Playlist[];
  isLoading: boolean;
  getPlaylist: (id: string) => Playlist | undefined;
  createPlaylist: (name: string, poemIds?: string[]) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addPoemToPlaylist: (playlistId: string, poemId: string) => Promise<void>;
  addPoemsToPlaylist: (playlistId: string, poemIds: string[]) => Promise<void>;
  removePoemFromPlaylist: (playlistId: string, poemId: string) => Promise<void>;
}

const PlaylistsContext = createContext<PlaylistsContextValue | undefined>(
  undefined,
);

export function PlaylistsProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const playlistsRef = useRef<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const stored = JSON.parse(raw) as Playlist[];
            playlistsRef.current = stored;
            setPlaylists(stored);
          } catch {
            setPlaylists([]);
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

  const persist = useCallback(async (next: Playlist[]) => {
    playlistsRef.current = next;
    setPlaylists(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updatePlaylists = useCallback(
    async (updater: (current: Playlist[]) => Playlist[]) => {
      const next = updater(playlistsRef.current);
      await persist(next);
    },
    [persist],
  );

  const getPlaylist = useCallback(
    (id: string) => playlists.find((p) => p.id === id),
    [playlists],
  );

  const createPlaylist = useCallback(
    async (name: string, poemIds: string[] = []) => {
      const playlist: Playlist = {
        id: makeLocalId('playlist'),
        name,
        poemIds: Array.from(new Set(poemIds)),
        createdAt: Date.now(),
      };
      await updatePlaylists((current) => [playlist, ...current]);
      return playlist;
    },
    [updatePlaylists],
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      await updatePlaylists((current) =>
        current.map((p) => (p.id === id ? { ...p, name } : p)),
      );
    },
    [updatePlaylists],
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await updatePlaylists((current) => current.filter((p) => p.id !== id));
    },
    [updatePlaylists],
  );

  const addPoemToPlaylist = useCallback(
    async (playlistId: string, poemId: string) => {
      await updatePlaylists((current) =>
        current.map((p) =>
          p.id === playlistId && !p.poemIds.includes(poemId)
            ? { ...p, poemIds: [...p.poemIds, poemId] }
            : p,
        ),
      );
    },
    [updatePlaylists],
  );

  const addPoemsToPlaylist = useCallback(
    async (playlistId: string, poemIds: string[]) => {
      const requestedIds = new Set(poemIds);
      await updatePlaylists((current) =>
        current.map((p) =>
          p.id === playlistId
            ? { ...p, poemIds: Array.from(new Set([...p.poemIds, ...requestedIds])) }
            : p,
        ),
      );
    },
    [updatePlaylists],
  );

  const removePoemFromPlaylist = useCallback(
    async (playlistId: string, poemId: string) => {
      await updatePlaylists((current) =>
        current.map((p) =>
          p.id === playlistId
            ? { ...p, poemIds: p.poemIds.filter((id) => id !== poemId) }
            : p,
        ),
      );
    },
    [updatePlaylists],
  );

  const value = useMemo(
    () => ({
      playlists,
      isLoading,
      getPlaylist,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addPoemToPlaylist,
      addPoemsToPlaylist,
      removePoemFromPlaylist,
    }),
    [
      playlists,
      isLoading,
      getPlaylist,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addPoemToPlaylist,
      addPoemsToPlaylist,
      removePoemFromPlaylist,
    ],
  );

  return (
    <PlaylistsContext.Provider value={value}>
      {children}
    </PlaylistsContext.Provider>
  );
}

export function usePlaylists() {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistsProvider');
  return ctx;
}
