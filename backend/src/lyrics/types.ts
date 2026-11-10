/** One word or syllable with its own timing (word-synced TTML / Spicy Lyrics). */
export interface LyricSyllable {
  text: string;
  /** Seconds from the start of the track. */
  start: number;
  end: number;
  /** True when the next syllable continues the same word (no space between). */
  partOfWord?: boolean;
}

export interface LyricLine {
  /** Start time in seconds. */
  time: number;
  end?: number;
  text: string;
  /** Present for word-level sync. */
  syllables?: LyricSyllable[];
  /** Secondary singer / duet: render on the opposite side. */
  oppositeAligned?: boolean;
}

export type LyricsSource =
  | 'embedded'
  | 'sidecar-ttml'
  | 'sidecar-lrc'
  | 'sidecar-txt'
  | 'spicy_lyrics'
  | 'apple_music'
  | 'spotify';

export interface LyricsAttribution {
  uploader?: { username: string; url?: string };
  maker?: { username: string; url?: string };
}

/** What GET /api/tracks/:id/lyrics returns (inside the usual { data } envelope). */
export interface LyricsResult {
  synced: boolean;
  lines: LyricLine[] | null;
  plainText: string | null;
  source: LyricsSource;
  /** Spotify track id the lyrics were matched to, for online sources. */
  spotifyId?: string;
  /** Only set for community syncs (source 'spicy_lyrics'). */
  attribution?: LyricsAttribution;
}
