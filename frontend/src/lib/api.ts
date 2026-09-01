import type {
  Album,
  Artist,
  Genre,
  LibraryStatus,
  Paged,
  Playlist,
  SearchResults,
  Track,
} from './types';

// ---- Lyrics types ----

export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResponse {
  synced: boolean;
  lines: LyricsLine[] | null;
  plainText: string | null;
}

/**
 * API client.
 *
 * The base URL is resolved once at module load:
 *   1. explicit VITE_API_BASE at build time (Electron/Capacitor/dev override)
 *   2. same-origin `/api` (default — works in a normal browser behind the
 *      Vite dev proxy and in production where the backend is reverse-proxied).
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Build an artwork URL for a track.
 *
 * Artwork is served by the backend per-track at /api/tracks/:id/artwork, which
 * resolves the album artwork cache internally. `album_artwork` from the API is
 * a *filesystem* path and is not directly fetchable, so we always go through
 * the endpoint when the track reports having artwork.
 */
export function artworkUrl(
  track: { id: number; has_artwork?: number; album_artwork?: string | null } | null | undefined,
): string | null {
  if (!track) return null;
  if (track.has_artwork || track.album_artwork) return apiUrl(`/api/tracks/${track.id}/artwork`);
  return null;
}

/** Build a stream URL for playback. */
export function streamUrl(trackId: number): string {
  return apiUrl(`/api/tracks/${trackId}/stream`);
}

/**
 * Build an artwork URL for an album. The API returns the *filesystem* path in
 * `artwork_path`; the artwork cache is served via the album endpoint.
 */
export function albumArtworkUrl(album: { id: number; artwork_path?: string | null } | null | undefined): string | null {
  if (!album?.artwork_path) return null;
  return apiUrl(`/api/albums/${album.id}/artwork`);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function reqEnvelope<T>(path: string, init?: RequestInit): Promise<T> {
  const json = await req<{ data: T }>(path, init);
  return json.data;
}

export const api = {
  // ---- Library ----
  libraryStatus: () => reqEnvelope<LibraryStatus>('/api/library/status'),
  scanLibrary: () => reqEnvelope<{ started: boolean }>('/api/library/scan', { method: 'POST' }),

  // ---- Tracks ----
  getTracks: (params: Record<string, string | number | boolean> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return req<Paged<Track[]>>(`/api/tracks?${qs}`);
  },
  getTrack: (id: number) => reqEnvelope<Track>(`/api/tracks/${id}`),
  bulkTracks: (ids: number[]) => reqEnvelope<Track[]>(`/api/tracks/bulk`, { method: 'POST', body: JSON.stringify({ ids }) }),
  favorite: (id: number, on: boolean) =>
    reqEnvelope<{ id: number; favorite: boolean }>(`/api/tracks/${id}/favorite`, { method: on ? 'PUT' : 'DELETE' }),

  // ---- Albums ----
  getAlbums: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return req<Paged<Album[]>>(`/api/albums?${qs}`);
  },
  getAlbum: (id: number) => reqEnvelope<Album>(`/api/albums/${id}`),

  // ---- Artists ----
  getArtists: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return req<Paged<Artist[]>>(`/api/artists?${qs}`);
  },
  getArtist: (id: number) => reqEnvelope<Artist>(`/api/artists/${id}`),

  // ---- Genres ----
  getGenres: () => reqEnvelope<Genre[]>(`/api/genres`),
  getGenre: (id: number) => reqEnvelope<Genre & { tracks: Track[]; albums: Album[] }>(`/api/genres/${id}`),

  // ---- Playlists ----
  getPlaylists: () => reqEnvelope<Playlist[]>('/api/playlists'),
  getPlaylist: (id: number) => reqEnvelope<Playlist>(`/api/playlists/${id}`),
  createPlaylist: (name: string, description?: string) =>
    reqEnvelope<Playlist>('/api/playlists', { method: 'POST', body: JSON.stringify({ name, description }) }),
  updatePlaylist: (id: number, patch: { name?: string; description?: string; positions?: number[] }) =>
    reqEnvelope<Playlist>(`/api/playlists/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deletePlaylist: (id: number) =>
    reqEnvelope<{ id: number; deleted: boolean }>(`/api/playlists/${id}`, { method: 'DELETE' }),
  addTracksToPlaylist: (id: number, trackIds: number[]) =>
    reqEnvelope<{ added: number }>(`/api/playlists/${id}/tracks`, { method: 'POST', body: JSON.stringify({ trackIds }) }),
  removeTrackFromPlaylist: (id: number, trackId: number) =>
    reqEnvelope<{ removed: boolean }>(`/api/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' }),

  // ---- Favorites ----
  getFavorites: () => req<Paged<Track[]>>('/api/favorites'),

  // ---- Recently played ----
  getRecentlyPlayed: () => reqEnvelope<Track[]>('/api/recently-played'),
  recordPlay: (trackId: number) =>
    reqEnvelope<{ recorded: boolean }>('/api/recently-played', { method: 'POST', body: JSON.stringify({ trackId }) }),

  // ---- Lyrics ----
  getLyrics: (trackId: number) => reqEnvelope<LyricsResponse | null>(`/api/tracks/${trackId}/lyrics`),

  // ---- Search ----
  search: async (q: string) => {
    // The backend wraps results as { data: { query, results: {...} } }.
    const json = await req<{ data: { query: string; results: SearchResults } }>(
      `/api/search?q=${encodeURIComponent(q)}`,
    );
    return json.data.results;
  },
};

/**
 * Fetch every page of a paged endpoint. The backend caps pages at 200 rows
 * each; virtualized list pages want the whole set up front. Bounded to
 * `maxItems` so a pathological library can't balloon memory.
 */
export async function fetchAllPaged<T>(
  fetchPage: (page: number) => Promise<Paged<T[]>>,
  maxItems = 5000,
): Promise<T[]> {
  const first = await fetchPage(1);
  if (first.total <= first.data.length) return first.data;
  const pages = Math.min(first.pages, Math.ceil(maxItems / first.limit));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchPage(i + 2)),
  );
  const out = first.data.concat(...rest.map((p) => p.data));
  return maxItems > 0 ? out.slice(0, maxItems) : out;
}
