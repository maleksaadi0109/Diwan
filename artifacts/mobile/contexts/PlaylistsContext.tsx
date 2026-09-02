import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addPoemToPlaylist: (playlistId: string, poemId: string) => Promise<void>;
  removePoemFromPlaylist: (playlistId: string, poemId: string) => Promise<void>;
}

const PlaylistsContext = createContext<PlaylistsContextValue | undefined>(
  undefined,
);

export function PlaylistsProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            setPlaylists(JSON.parse(raw) as Playlist[]);
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
    setPlaylists(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const getPlaylist = useCallback(
    (id: string) => playlists.find((p) => p.id === id),
    [playlists],
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      const playlist: Playlist = {
        id: makeLocalId('playlist'),
        name,
        poemIds: [],
        createdAt: Date.now(),
      };
      await persist([playlist, ...playlists]);
      return playlist;
    },
    [playlists, persist],
  );

  const renamePlaylist = useCallback(
    async (id: string, name: string) => {
      await persist(playlists.map((p) => (p.id === id ? { ...p, name } : p)));
    },
    [playlists, persist],
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await persist(playlists.filter((p) => p.id !== id));
    },
    [playlists, persist],
  );

  const addPoemToPlaylist = useCallback(
    async (playlistId: string, poemId: string) => {
      await persist(
        playlists.map((p) =>
          p.id === playlistId && !p.poemIds.includes(poemId)
            ? { ...p, poemIds: [...p.poemIds, poemId] }
            : p,
        ),
      );
    },
    [playlists, persist],
  );

  const removePoemFromPlaylist = useCallback(
    async (playlistId: string, poemId: string) => {
      await persist(
        playlists.map((p) =>
          p.id === playlistId
            ? { ...p, poemIds: p.poemIds.filter((id) => id !== poemId) }
            : p,
        ),
      );
    },
    [playlists, persist],
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
