import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { api } from '../lib/api';
import { usePlayerStore } from '../stores/playerStore';
import { formatCount } from '../lib/format';
import type { Album, Genre, Track } from '../lib/types';
import { PageHeader } from '../components/ui/PageHeader';
import { TrackTable } from '../components/tracks/TrackTable';
import { AlbumCard } from '../components/cards/AlbumCard';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

type GenreDetail = Genre & { tracks: Track[]; albums: Album[] };

export function GenreDetail() {
  const { id } = useParams();
  const [genre, setGenre] = useState<GenreDetail | null>(null);
  const [error, setError] = useState(false);
  const playTracks = usePlayerStore((s) => s.playTracks);

  useEffect(() => {
    let cancelled = false;
    setGenre(null);
    setError(false);
    api
      .getGenre(Number(id))
      .then((g) => {
        if (!cancelled) setGenre(g);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return <EmptyState title="Genre not found" message="This genre may have been removed." />;
  }

  if (!genre) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  const tracks = genre.tracks ?? [];

  return (
    <div>
      <PageHeader
        title={genre.name}
        subtitle={formatCount(tracks.length, 'song')}
        actions={
          tracks.length > 0 ? (
            <button
              type="button"
              onClick={() => playTracks(tracks)}
              className="btn-accent !px-5 !py-2 text-sm"
            >
              <Play className="h-4 w-4 fill-current" strokeWidth={0} />
              Play
            </button>
          ) : undefined
        }
      />

      {genre.albums.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {genre.albums.slice(0, 10).map((a, i) => (
              <AlbumCard key={a.id} album={a} index={i} />
            ))}
          </div>
        </>
      )}

      {tracks.length === 0 ? (
        <EmptyState title="No tracks" message="No songs in this genre yet." />
      ) : (
        <TrackTable tracks={tracks} showAlbum />
      )}
    </div>
  );
}