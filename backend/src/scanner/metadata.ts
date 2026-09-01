import path from 'node:path';
import { parseFile } from 'music-metadata';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

/**
 * Supported audio extensions (lowercase).
 */
export const SUPPORTED_EXTENSIONS = new Set([
  'flac', 'mp3', 'aac', 'm4a', 'alac', 'wav', 'ogg', 'opus',
  // aliases/containers that carry the above codecs
  'mp4', 'm4b', 'aiff', 'aif', 'wma',
]);

export interface ExtractedMetadata {
  title: string | null;
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  composer: string | null;
  duration: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  codec: string | null;
  hasArtwork: boolean;
  artworkBuffer: Buffer | null;
  hasLyrics: boolean;
}

/**
 * Read metadata for a single audio file. Falls back gracefully when tags are
 * absent — a filename-based title is derived in the scanner when needed.
 */
export async function extractMetadata(filePath: string): Promise<ExtractedMetadata> {
  let meta: Awaited<ReturnType<typeof parseFile>> | null = null;
  try {
    meta = await parseFile(filePath, {
      skipCovers: false,
      duration: true,
    });
  } catch {
    // Some formats (e.g. ALAC-in-M4A edge cases, corrupt files) fail to parse
    // fully; we still want to index the file. Skip to ffprobe fallback.
  }

  const common = (meta?.common ?? {}) as Record<string, unknown>;
  const format = (meta?.format ?? {}) as Record<string, unknown>;

  // Derive codec / sample rate / bit depth, preferring ffprobe for fields that
  // music-metadata may omit (notably bit depth and sample rate on lossless).
  const probe = await ffprobeBitDepth(filePath);

  const pictures = common.picture as Array<{ data?: Buffer } | undefined> | undefined;
  const hasArtwork = !!(pictures && pictures.length > 0);
  const artworkBuffer = pictures?.[0]?.data ?? null;

  // Lyrics: check for embedded lyrics in metadata tags.
  // music-metadata exposes lyrics as ILyricsTag[] — each tag may have
  // `text` (unsynced) or `syncText[].text` (synced).
  const lyricsTags = common.lyrics as Array<{
    text?: string;
    syncText?: Array<{ text: string }>;
  }> | undefined;
  const hasLyrics = Array.isArray(lyricsTags) && lyricsTags.some((tag) => {
    if (Array.isArray(tag.syncText) && tag.syncText.length > 0) return true;
    return typeof tag.text === 'string' && tag.text.trim().length > 0;
  });

  // Bitrate: report format.bitrate, fall back to probe.
  let bitrate = typeof format.bitrate === 'number' ? format.bitrate : null;
  let sampleRate = (typeof format.sampleRate === 'number' ? format.sampleRate : null) ?? probe.sampleRate;
  let bitDepth = probe.bitDepth;
  let codec = (typeof format.codec === 'string' ? format.codec : null) ?? probe.codec ?? null;

  // Normalize codec names for display.
  if (codec && /alac/i.test(codec)) codec = 'ALAC';
  else if (codec && /flac/i.test(codec)) codec = 'FLAC';
  else if (codec && /mp3|mpeg/i.test(codec)) codec = 'MP3';
  else if (codec && /aac/i.test(codec)) codec = 'AAC';
  else if (codec && /opus/i.test(codec)) codec = 'Opus';
  else if (codec && /vorbis|ogg/i.test(codec)) codec = 'Vorbis';
  else if (codec && /pcm|wav/i.test(codec)) codec = 'PCM';

  // Year: multiple possible fields.
  let year: number | null = null;
  const y = (common.year as number | undefined) ?? (common.originalyear as number | undefined);
  if (typeof y === 'number' && y > 0) year = y;

  return {
    title: typeof common.title === 'string' ? common.title : null,
    artist: typeof common.artist === 'string' ? common.artist : null,
    albumArtist: typeof common.albumartist === 'string' ? common.albumartist : null,
    album: typeof common.album === 'string' ? common.album : null,
    genre: Array.isArray(common.genre) ? (common.genre[0] ?? null) : (common.genre ?? null),
    year,
    trackNumber: (() => {
      const n = (common.track as { no?: number } | undefined)?.no;
      return typeof n === 'number' && n > 0 ? n : null;
    })(),
    discNumber: (() => {
      const n = (common.disk as { no?: number } | undefined)?.no;
      return typeof n === 'number' && n > 0 ? n : null;
    })(),
    composer: typeof common.composer === 'string' ? common.composer : null,
    duration: typeof format.duration === 'number' && format.duration > 0 ? format.duration : null,
    bitrate,
    sampleRate,
    bitDepth,
    codec,
    hasArtwork,
    artworkBuffer,
    hasLyrics,
  };
}

async function ffprobeBitDepth(filePath: string): Promise<{
  bitDepth: number | null;
  sampleRate: number | null;
  codec: string | null;
}> {
  try {
    const { stdout } = await execFileP(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=bits_per_raw_sample,sample_rate,codec_name,bit_rate',
        '-of', 'json',
        filePath,
      ],
      { timeout: 15000 },
    );
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{
        bits_per_raw_sample?: string;
        sample_rate?: string;
        codec_name?: string;
        bit_rate?: string;
      }>;
    };
    const s = parsed.streams?.[0];
    if (!s) return { bitDepth: null, sampleRate: null, codec: null };
    return {
      bitDepth: s.bits_per_raw_sample && s.bits_per_raw_sample !== '0'
        ? parseInt(s.bits_per_raw_sample, 10)
        : null,
      sampleRate: s.sample_rate ? parseInt(s.sample_rate, 10) : null,
      codec: s.codec_name ?? null,
    };
  } catch {
    return { bitDepth: null, sampleRate: null, codec: null };
  }
}

/** Strip common leading track numbers / disc prefixes from a filename title. */
export function deriveTitleFromFilename(filePath: string): string {
  const base = path.basename(filePath).replace(/\.[^.]+$/, '');
  let title = base.replace(/^\s*\d{1,3}[\s._-]+/, ''); // "01 - Song"
  title = title.replace(/^\s*\d{1,3}\s*[-_.]\s*/g, '');
  title = title.trim();
  return title || base;
}
