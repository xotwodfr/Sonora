import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Disc3, Play, Shuffle } from 'lucide-react';
import { api, albumArtworkUrl } from '../lib/api';
import { usePlayerStore } from '../stores/playerStore';
import { formatCount, formatLength } from '../lib/format';
import type { Album } from '../lib/types';
import { Artwork } from '../components/ui/Artwork';
import { TrackTable } from '../components/tracks/TrackTable';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

export function AlbumDetail() {
  const { id } = useParams();
  const [album, setAlbum] = useState<Album | null>(null);
  const [error, setError] = useState(false);
  const playTracks = usePlayerStore((s) => s.playTracks);

  useEffect(() => {
    let cancelled = false;
    setAlbum(null);
    setError(false);
    api
      .getAlbum(Number(id))
      .then((a) => {
        if (!cancelled) setAlbum(a);
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
      <EmptyState
        icon={Disc3}
        title="Album not found"
        message="This album may have been removed from your library."
      />
    );
  }

  if (!album) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  const tracks = album.tracks ?? [];
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
      <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-44 shrink-0 sm:w-52"
        >
          <Artwork
            src={albumArtworkUrl(album)}
            alt={album.title}
            className="aspect-square w-full shadow-2xl shadow-black/40"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
          className="min-w-0"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            Album
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {album.title}
          </h1>
          <p className="mt-1.5 text-sm text-secondary">
            {album.album_artist ?? 'Various Artists'}
            {album.year ? ` · ${album.year}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-tertiary">
            {album.track_count} songs · {totalSeconds > 0 ? formatLength(totalSeconds) : ''}
            {album.total_discs && album.total_discs > 1 ? ` · ${album.total_discs} discs` : ''}
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
        </motion.div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState icon={Disc3} title="No tracks" message="This album has no playable tracks." />
      ) : (
        <TrackTable
          tracks={tracks}
          showArtist
          header={
            <div className="mb-1 text-xs text-tertiary">
              {formatCount(tracks.length, 'song')} · {formatLength(totalSeconds)}
            </div>
          }
        />
      )}
    </div>
  );
}