import { create } from 'zustand';
import { api } from '../lib/api';
import type {
  Album,
  Artist,
  Genre,
  LibraryStatus,
  Playlist,
  Track,
} from '../lib/types';

interface LibraryState {
  status: LibraryStatus | null;
  albums: Album[];
  artists: Artist[];
  genres: Genre[];
  playlists: Playlist[];
  favorites: Track[];
  recentlyPlayed: Track[];
  albumsLoaded: boolean;
  artistsLoaded: boolean;
  genresLoaded: boolean;
  playlistsLoaded: boolean;
  favoritesLoaded: boolean;
  recentlyLoaded: boolean;
  loading: boolean;
  error: string | null;

  createPlaylist: (name?: string, description?: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  loadStatus: () => Promise<void>;
  loadAlbums: (force?: boolean) => Promise<void>;
  loadArtists: (force?: boolean) => Promise<void>;
  loadGenres: (force?: boolean) => Promise<void>;
  loadPlaylists: (force?: boolean) => Promise<void>;
  loadFavorites: (force?: boolean) => Promise<void>;
  loadRecentlyPlayed: (force?: boolean) => Promise<void>;
  refreshAll: () => Promise<void>;
  runScan: () => Promise<boolean>;
  toggleFavorite: (trackId: number) => Promise<void>;
  /** Invalidate playlist list + a specific playlist's cached data. */
  touchPlaylists: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  status: null,
  albums: [],
  artists: [],
  genres: [],
  playlists: [],
  favorites: [],
  recentlyPlayed: [],
  albumsLoaded: false,
  artistsLoaded: false,
  genresLoaded: false,
  playlistsLoaded: false,
  favoritesLoaded: false,
  recentlyLoaded: false,
  loading: false,
  error: null,

  createPlaylist: async (name, description) => {
    const base = name?.trim() ?? `Playlist ${get().playlists.length + 1}`;
    await api.createPlaylist(base || 'Untitled', description);
    await get().touchPlaylists();
  },

  deletePlaylist: async (id) => {
    await api.deletePlaylist(id);
    await get().touchPlaylists();
  },

  loadStatus: async () => {
    try {
      const status = await api.libraryStatus();
      set({ status });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load status' });
    }
  },

  loadAlbums: async (force) => {
    if (get().albumsLoaded && !force) return;
    try {
      set({ loading: true, error: null });
      const res = await api.getAlbums({ limit: 500 });
      set({ albums: res.data, albumsLoaded: true, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load albums', loading: false });
    }
  },

  loadArtists: async (force) => {
    if (get().artistsLoaded && !force) return;
    try {
      const res = await api.getArtists({ limit: 500 });
      set({ artists: res.data, artistsLoaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load artists' });
    }
  },

  loadGenres: async (force) => {
    if (get().genresLoaded && !force) return;
    try {
      const genres = await api.getGenres();
      set({ genres, genresLoaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load genres' });
    }
  },

  loadPlaylists: async (force) => {
    if (get().playlistsLoaded && !force) return;
    try {
      const playlists = await api.getPlaylists();
      set({ playlists, playlistsLoaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load playlists' });
    }
  },

  loadFavorites: async (force) => {
    if (get().favoritesLoaded && !force) return;
    try {
      const res = await api.getFavorites();
      set({ favorites: res.data, favoritesLoaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load favorites' });
    }
  },

  loadRecentlyPlayed: async (force) => {
    if (get().recentlyLoaded && !force) return;
    try {
      const recentlyPlayed = await api.getRecentlyPlayed();
      set({ recentlyPlayed, recentlyLoaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load recently played' });
    }
  },

  refreshAll: async () => {
    set({ albumsLoaded: false, artistsLoaded: false, genresLoaded: false, playlistsLoaded: false, favoritesLoaded: false, recentlyLoaded: false });
    await Promise.all([
      get().loadStatus(),
      get().loadAlbums(true),
      get().loadArtists(true),
      get().loadGenres(true),
      get().loadPlaylists(true),
      get().loadFavorites(true),
      get().loadRecentlyPlayed(true),
    ]);
  },

  runScan: async () => {
    try {
      await api.scanLibrary();
      // Poll status until scan finishes, then refresh aggregates.
      const poll = async () => {
        const status = await api.libraryStatus();
        set({ status });
        if (status.scan.running) {
          setTimeout(poll, 1200);
        } else {
          await get().refreshAll();
        }
      };
      await poll();
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Scan failed' });
      return false;
    }
  },

  toggleFavorite: async (trackId) => {
    const cur = get().favorites.find((t) => t.id === trackId);
    const on = !cur;
    await api.favorite(trackId, on);
    // Optimistically update status counter + refresh favorites & any local page.
    set((s) => ({
      favorites: on
        ? [...s.favorites, { id: trackId } as Track]
        : s.favorites.filter((t) => t.id !== trackId),
      status: s.status ? { ...s.status, favorites: s.status.favorites + (on ? 1 : -1) } : s.status,
    }));
    // Re-fetch full favorite rows.
    get().loadFavorites(true);
  },

  touchPlaylists: async () => {
    set({ playlistsLoaded: false });
    await get().loadPlaylists();
  },
}));
