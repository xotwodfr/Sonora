import { Heart } from 'lucide-react';
import type { Track } from '../../lib/types';
import { TrackRow } from './TrackRow';
import { EmptyState } from '../ui/EmptyState';

interface TrackTableProps {
  tracks: Track[];
  showAlbum?: boolean;
  showArtist?: boolean;
  showArtwork?: boolean;
  onRemove?: (track: Track) => void;
  /** Rendered above the header (page-level play/shuffle actions). */
  header?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  ariaLabel?: string;
}

/**
 * Standard track listing with a column header that matches TrackRow metrics
 * exactly (so columns line up). React Router pages reuse this everywhere.
 */
export function TrackTable({
  tracks,
  showAlbum = false,
  showArtist = false,
  showArtwork = false,
  onRemove,
  header,
  emptyTitle = 'No songs',
  emptyMessage = 'Nothing to show here yet.',
  ariaLabel = 'Tracks',
}: TrackTableProps) {
  if (tracks.length === 0) {
    return (
      <div>
        {header}
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </div>
    );
  }

  return (
    <div>
      {header}
      <div role="grid" aria-label={ariaLabel}>
        <div className="flex items-center gap-3 px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
          <span className="w-6 shrink-0" aria-hidden>
            #
          </span>
          <span className="min-w-0 flex-1">Title</span>
          {showArtist && <span className="hidden w-44 shrink-0 md:block">Artist</span>}
          {showAlbum && <span className="hidden w-48 shrink-0 lg:block">Album</span>}
          <span className="w-7 shrink-0 text-center" aria-hidden>
            <Heart className="mx-auto h-3 w-3 opacity-0" aria-hidden />
          </span>
          <span className="w-10 shrink-0 text-right">Time</span>
          <span className="w-8 shrink-0" aria-hidden />
        </div>
        <div className="flex flex-col gap-0.5">
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              showAlbum={showAlbum}
              showArtist={showArtist}
              showArtwork={showArtwork}
              onRemove={onRemove}
              tracksForPlay={tracks}
            />
          ))}
        </div>
      </div>
    </div>
  );
}