import { useEffect, useMemo, useState } from 'react';
import { AudioLines } from 'lucide-react';
import { api, fetchAllPaged } from '../lib/api';
import { formatCount } from '../lib/format';
import type { Artist } from '../lib/types';
import { PageHeader } from '../components/ui/PageHeader';
import { ArtistCard } from '../components/cards/ArtistCard';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function Artists() {
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAllPaged((page) => api.getArtists({ page, limit: 200, sort: 'name' }))
      .then((data) => {
        if (!cancelled) setArtists(data);
      })
      .catch(() => {
        if (!cancelled) setArtists([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!artists) return [];
    const needle = q.trim().toLowerCase();
    return needle ? artists.filter((a) => a.name.toLowerCase().includes(needle)) : artists;
  }, [artists, q]);

  if (!artists) return <CardSkeletons count={12} />;

  return (
    <div>
      <PageHeader
        title="Artists"
        subtitle={artists.length > 0 ? `${formatCount(artists.length, 'artist')}` : undefined}
        actions={
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter artists"
            aria-label="Filter artists"
            className="glass-control h-8 w-40 rounded-full px-3 text-xs outline-none placeholder:text-tertiary sm:w-48"
          />
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={AudioLines}
          title={artists.length === 0 ? 'No artists yet' : 'No matches'}
          message={
            artists.length === 0
              ? 'Artists from your scanned library will appear here.'
              : 'Try a different search.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((a, i) => (
            <ArtistCard key={a.id} artist={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}