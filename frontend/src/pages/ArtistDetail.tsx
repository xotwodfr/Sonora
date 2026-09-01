import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AudioLines, Play, Shuffle } from 'lucide-react';
import { api } from '../lib/api';
import { usePlayerStore } from '../stores/playerStore';
import { formatCount, formatLength } from '../lib/format';
import type { Album, Artist, Track } from '../lib/types';
import { SectionHeader } from '../components/ui/PageHeader';
import { AlbumCard } from '../components/cards/AlbumCard';
import { TrackTable } from '../components/tracks/TrackTable';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

type ArtistDetail = Artist & { albums: Album[]; topTracks: Track[] };

export function ArtistDetail() {
  const { id } = useParams();
  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [error, setError] = useState(false);
  const playTracks = usePlayerStore((s) => s.playTracks);

  useEffect(() => {
    let cancelled = false;
    setArtist(null);
    setError(false);
    api
      .getArtist(Number(id))
      .then((a) => {
        if (!cancelled) {
          // The API returns slim top-track rows; mark them as favorites where set.
          setArtist({
            ...a,
            albums: a.albums ?? [],
            topTracks: (a.topTracks ?? []).map((t) => ({ ...t, artist: a.name }) as Track),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <EmptyState icon={AudioLines} title="Artist not found" message="This artist may have been removed." />
    );
  }

  if (!artist) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  const tracks = artist.topTracks ?? [];
  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration ?? 0), 0);

  const play = () => playTracks(tracks);
  const playShuffled = () => {
    usePlayerStore.getState().setShuffle(false);
    playTracks(tracks);
    usePlayerStore.getState().setShuffle(true);
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-6 flex flex-wrap items-end gap-6"
      >
        <div
          className="grid h-36 w-36 shrink-0 place-items-center rounded-full text-white shadow-2xl shadow-black/40 sm:h-44 sm:w-44"
          style={{ background: monogramColor(artist.name) }}
        >
          <AudioLines className="h-1/2 w-1/2 opacity-80" strokeWidth={1.2} />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            Artist
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{artist.name}</h1>
          <p className="mt-1.5 text-sm text-secondary">
            {formatCount(artist.album_count, 'album')} · {formatCount(artist.track_count, 'song')}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" onClick={play} className="btn-accent !px-6 !py-2 text-sm">
              <Play className="h-4 w-4 fill-current" strokeWidth={0} />
              Play
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" onClick={playShuffled} className="glass-control text-sm">
              <Shuffle className="h-4 w-4" strokeWidth={1.9} />
              <span className="ml-1.5 hidden sm:inline">Shuffle</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Top songs */}
      {tracks.length > 0 && (
        <>
          <SectionHeader
            title="Top Songs"
            action={<span className="text-xs text-tertiary">{formatLength(totalSeconds)}</span>}
          />
          <TrackTable tracks={artist.topTracks as Track[]} />
        </>
      )}

      {/* Albums */}
      {artist.albums.length > 0 && (
        <>
          <SectionHeader
            title="Albums"
            action={
              <span className="text-xs text-tertiary">
                {artist.albums.length} release{artist.albums.length === 1 ? '' : 's'}
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {artist.albums.map((a, i) => (
              <AlbumCard key={a.id} album={a} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Monogram color derived from the name — cheerful, unique per artist. */
function monogramColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 65% 52%), hsl(${(h + 40) % 360} 70% 44%))`;
}