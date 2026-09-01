import { useEffect, useMemo, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { api, fetchAllPaged } from '../lib/api';
import { formatCount } from '../lib/format';
import type { Album } from '../lib/types';
import { PageHeader } from '../components/ui/PageHeader';
import { AlbumCard } from '../components/cards/AlbumCard';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

type SortKey = 'title' | 'year' | 'artist' | 'added';

const SORTS: { key: SortKey; label: string; sort: string }[] = [
  { key: 'title', label: 'Title', sort: 'title' },
  { key: 'year', label: 'Year', sort: 'year' },
  { key: 'artist', label: 'Artist', sort: 'artist' },
  { key: 'added', label: 'Recently Added', sort: 'added_at' },
];

/** Albums — full grid with a lightweight sort switcher. */
export function Albums() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [sort, setSort] = useState<SortKey>('title');
  const [q, setQ] = useState('');

  useEffect(() => {
    const sortParam = SORTS.find((s) => s.key === sort)?.sort ?? 'title';
    let cancelled = false;
    fetchAllPaged((page) =>
      api.getAlbums({ page, limit: 200, sort: sortParam, order: sort === 'title' || sort === 'artist' ? 'asc' : 'desc' }),
    )
      .then((data) => {
        if (!cancelled) setAlbums(data);
      })
      .catch(() => {
        if (!cancelled) setAlbums([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sort]);

  const filtered = useMemo(() => {
    if (!albums) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return albums;
    return albums.filter(
      (a) => a.title.toLowerCase().includes(needle) || (a.album_artist ?? '').toLowerCase().includes(needle),
    );
  }, [albums, q]);

  if (!albums) return <CardSkeletons count={12} />;

  return (
    <div>
      <PageHeader
        title="Albums"
        subtitle={albums.length > 0 ? `${formatCount(albums.length, 'album')}` : undefined}
        actions={
          <>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter albums"
              aria-label="Filter albums"
              className="glass-control h-8 w-40 rounded-full px-3 text-xs outline-none placeholder:text-tertiary sm:w-48"
            />
            <div className="flex items-center gap-1 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] p-0.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    sort === s.key ? 'bg-[var(--surface-2)] text-default' : 'text-tertiary hover:text-secondary'
                  }`}
                  aria-pressed={sort === s.key}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Disc3}
          title={albums.length === 0 ? 'No albums yet' : 'No matches'}
          message={
            albums.length === 0
              ? 'Scan a music folder to build your album library.'
              : 'Try a different search or reset the filter.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((a, i) => (
            <AlbumCard key={a.id} album={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

