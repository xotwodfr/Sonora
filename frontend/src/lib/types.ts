/** Shared domain types mirroring the backend API response shapes. */

export interface Track {
  id: number;
  file_path: string;
  title: string;
  artist: string | null;
  artist_id: number | null;
  album: string | null;
  album_id: number | null;
  genre: string | null;
  genre_id: number | null;
  track_number: number | null;
  disc_number: number | null;
  year: number | null;
  composer: string | null;
  duration: number | null;
  bitrate: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  codec: string | null;
  has_artwork: number;
  has_lyrics: number;
  album_artwork: string | null;
  favorite: number;
  added_at: number;
  modified_at: number;
}

export interface Album {
  id: number;
  title: string;
  album_artist: string | null;
  year: number | null;
  total_tracks: number | null;
  total_discs: number | null;
  artwork_path: string | null;
  track_count: number;
  artist_count: number;
  total_duration: number;
  tracks?: Track[];
}

export interface Artist {
  id: number;
  name: string;
  artwork_path: string | null;
  track_count: number;
  album_count: number;
  albums?: Album[];
  topTracks?: Track[];
}

export interface Genre {
  id: number;
  name: string;
  track_count: number;
  album_count: number;
}

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  track_count: number;
  tracks?: Track[];
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  genres: Genre[];
  playlists: Playlist[];
}

export interface ScanProgress {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  phase: 'idle' | 'scanning' | 'cleaning' | 'done' | 'error';
  filesScanned: number;
  filesFound: number;
  filesNew: number;
  filesUpdated: number;
  filesDeleted: number;
  errors: number;
  currentFile: string | null;
  message: string;
}

export interface LibraryStatus {
  tracks: number;
  albums: number;
  artists: number;
  genres: number;
  playlists: number;
  favorites: number;
  musicPath: string;
  dataPath: string;
  scan: ScanProgress;
}

export interface Paged<T> {
  data: T;
  total: number;
  page: number;
  limit: number;
  pages: number;
}
