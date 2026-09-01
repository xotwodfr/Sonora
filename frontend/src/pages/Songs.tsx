import { useEffect, useMemo, useState } from 'react';
import { Music2, Search } from 'lucide-react';
import { api, fetchAllPaged } from '../lib/api';
import { formatCount, formatLength } from '../lib/format';
import type { Track } from '../lib/types';
import { PageHeader } from '../components/ui/PageHeader';
import { TrackRow } from '../components/tracks/TrackRow';
import { VirtualList } from '../components/ui/VirtualList';
import { EmptyState } from '../components/ui/EmptyState';

const ROW_H = 48;

/** Songs — the entire library virtualized: tens of thousands of rows, cheap. */
export function Songs() {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAllPaged(
      (page) => api.getTracks({ page, limit: 200, sort: 'title', order: 'asc' }),
      20000,
    )
      .then((data) => {
        if (!cancelled) setTracks(data);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!tracks) return [];
    const needle = q.trim().toLowerCase();
    return needle
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(needle) ||
            (t.artist ?? '').toLowerCase().includes(needle) ||
            (t.album ?? '').toLowerCase().includes(needle),
        )
      : tracks;
  }, [tracks, q]);

  const totalSeconds = useMemo(
    () => filtered.reduce((acc, t) => acc + (t.duration ?? 0), 0),
    [filtered],
  );

  if (!tracks) {
    return (
      <div>
        <PageHeader title="Songs" />
        <div className="flex flex-col gap-0.5">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton animate-pulse h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Songs"
        subtitle={tracks.length > 0 ? formatCount(tracks.length, 'song') : undefined}
        actions={
          <label className="glass-control h-9 w-full max-w-xs gap-2 !rounded-full px-3 sm:w-64">
            <Search className="h-4 w-4 shrink-0 text-tertiary" strokeWidth={1.9} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter songs"
              className="w-full bg-transparent text-sm text-default outline-none placeholder:text-tertiary"
              aria-label="Filter songs"
            />
          </label>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Music2}
          title={tracks.length === 0 ? 'No songs yet' : 'No matches'}
          message={
            tracks.length === 0
              ? 'Scan a music folder and all your songs will be listed here.'
              : `Nothing matches "${q}".`
          }
        />
      ) : (
        <div>
          {/* Column header */}
          <div className="sticky-header flex items-center gap-3 px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
            <span className="w-6 shrink-0" aria-hidden>#</span>
            <span className="min-w-0 flex-1">Title</span>
            <span className="hidden w-44 shrink-0 md:block">Artist</span>
            <span className="hidden w-48 shrink-0 lg:block">Album</span>
            <span className="w-7 shrink-0" aria-hidden />
            <span className="w-10 shrink-0 text-right">Time</span>
            <span className="w-8 shrink-0" aria-hidden />
          </div>

          <VirtualList
            items={filtered}
            rowHeight={ROW_H}
            ariaLabel="All songs"
            renderRow={(track) => (
              <TrackRow
                track={track}
                showArtist
                showAlbum
                tracksForPlay={filtered}
                key={track.id}
              />
            )}
          />

          <div className="mt-2 text-xs text-tertiary">
            {formatCount(filtered.length, 'song')} · {formatLength(totalSeconds)}
          </div>
        </div>
      )}
    </div>
  );
}

// Fixed row height exposed so tests/VRAM can align with the list.
export const SONGS_ROW_HEIGHT = ROW_H;