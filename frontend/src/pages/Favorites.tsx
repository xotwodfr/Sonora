import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Play, Shuffle } from 'lucide-react';
import { useLibraryStore } from '../stores/libraryStore';
import { usePlayerStore } from '../stores/playerStore';
import { formatCount, formatLength } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { TrackTable } from '../components/tracks/TrackTable';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function Favorites() {
  const favorites = useLibraryStore((s) => s.favorites);
  const favoritesLoaded = useLibraryStore((s) => s.favoritesLoaded);
  const loadFavorites = useLibraryStore((s) => s.loadFavorites);
  const playTracks = usePlayerStore((s) => s.playTracks);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  if (!favoritesLoaded) return <CardSkeletons count={8} />;

  const totalSeconds = favorites.reduce((acc, t) => acc + (t.duration ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Favorites"
        subtitle={favorites.length > 0 ? `${formatCount(favorites.length, 'song')}` : undefined}
        actions={
          favorites.length > 0 ? (
            <>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" className="btn-accent !px-5 !py-2 text-sm" onClick={() => playTracks(favorites)}>
                <Play className="h-4 w-4 fill-current" strokeWidth={0} />
                Play
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" className="glass-control text-sm" onClick={() => {
                usePlayerStore.getState().setShuffle(false);
                playTracks(favorites);
                usePlayerStore.getState().setShuffle(true);
              }}>
                <Shuffle className="h-4 w-4" strokeWidth={1.9} />
                <span className="ml-1.5 hidden sm:inline">Shuffle</span>
              </motion.button>
            </>
          ) : undefined
        }
      />

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favorites yet"
          message="Tap the heart on any track to add it here."
        />
      ) : (
        <TrackTable
          tracks={favorites}
          showAlbum
          header={
            <div className="mb-1 text-xs text-tertiary">
              {formatCount(favorites.length, 'song')} · {formatLength(totalSeconds)}
            </div>
          }
        />
      )}
    </div>
  );
}