import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatCount } from '../lib/format';
import type { Track } from '../lib/types';
import { PageHeader } from '../components/ui/PageHeader';
import { TrackTable } from '../components/tracks/TrackTable';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

/** Recently Added — tracks added at the most recent scan, newest first. */
export function RecentlyAdded() {
  const [tracks, setTracks] = useState<Track[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getTracks({ sort: 'added_at', order: 'desc', limit: 100 })
      .then((res) => {
        if (!cancelled) setTracks(res.data);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!tracks) return <CardSkeletons count={8} />;

  return (
    <div>
      <PageHeader
        title="Recently Added"
        subtitle={
          tracks.length > 0 ? `${formatCount(tracks.length, 'song')} added recently` : undefined
        }
      />

      {tracks.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="Nothing added yet"
          message="Scanned tracks appear here newest-first — rescan your library to refresh."
        />
      ) : (
        <TrackTable tracks={tracks} showAlbum />
      )}
    </div>
  );
}