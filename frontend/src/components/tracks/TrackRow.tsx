import { useState } from 'react';
import { ArrowDown, ArrowUp, Heart, ListMusic, ListPlus, Play, Plus, Trash2 } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { api, artworkUrl } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { Artwork } from '../ui/Artwork';
import { Menu, type MenuItem } from '../ui/Menu';
import type { Track } from '../../lib/types';

interface TrackRowProps {
  track: Track;
  showAlbum?: boolean;
  showArtist?: boolean;
  showArtwork?: boolean;
  /** Enable remove (used on playlist / recently / favorites pages). */
  onRemove?: (track: Track) => void;
  /** Enable reorder (playlist detail pages). */
  onMoveUp?: (track: Track) => void;
  onMoveDown?: (track: Track) => void;
  /** If set, playing this row uses this explicit track set. */
  tracksForPlay?: Track[];
}

/** A single track row: hover play button, favorite, "⋯" actions. */
export function TrackRow({
  track,
  showAlbum = false,
  showArtist = false,
  showArtwork = false,
  onRemove,
  onMoveUp,
  onMoveDown,
  tracksForPlay,
}: TrackRowProps) {
  const [fav, setFav] = useState(!!track.favorite);
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const playNext = usePlayerStore((s) => s.playNext);
  const enqueue = usePlayerStore((s) => s.enqueue);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const playlists = useLibraryStore((s) => s.playlists);

  const isCurrent = current?.id === track.id;
  const pool = tracksForPlay ?? [track];

  const art = artworkUrl(track);

  const handleFavorite = async () => {
    setFav(!fav);
    await toggleFavorite(track.id).catch(() => setFav(fav));
  };

  const addToPlaylist = async (playlistId: number) => {
    try {
      await api.addTracksToPlaylist(playlistId, [track.id]);
      void useLibraryStore.getState().touchPlaylists();
    } catch {
      /* ignored */
    }
  };

  const menuItems: (MenuItem | 'divider')[] = [
    ...(onMoveUp
      ? [{ label: 'Move up', icon: ArrowUp, onSelect: () => onMoveUp(track) } as MenuItem]
      : []),
    ...(onMoveDown
      ? [{ label: 'Move down', icon: ArrowDown, onSelect: () => onMoveDown(track) } as MenuItem]
      : []),
    ...(onMoveUp || onMoveDown ? (['divider'] as const) : []),
    { label: 'Play next', icon: ListPlus, onSelect: () => playNext(track) },
    { label: 'Add to queue', icon: ListMusic, onSelect: () => enqueue([track]) },
    {
      label: 'Add to playlist',
      icon: Plus,
      items: playlists.length
        ? playlists.map((p) => ({
            label: p.name,
            onSelect: () => void addToPlaylist(p.id),
          }))
        : [{ label: 'No playlists yet', onSelect: () => {} }],
    },
    'divider',
    fav
      ? {
          label: 'Remove from favorites',
          icon: Heart,
          onSelect: () => handleFavorite(),
        }
      : {
          label: 'Add to favorites',
          icon: Heart,
          onSelect: () => handleFavorite(),
        },
    ...(onRemove
      ? [
          {
            label: 'Remove from list',
            icon: Trash2,
            danger: true,
            onSelect: () => onRemove(track),
          } as MenuItem,
        ]
      : []),
  ];

  return (
    <div
      role="row"
      className={`group flex items-center gap-3 rounded-lg px-2.5 py-[7px] transition-colors ${
        isCurrent ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--glass-fill-strong)]'
      }`}
    >
      {/* Index / play */}
      <div className="relative grid h-8 w-6 shrink-0 place-items-center">
        {showArtwork && (
          <button
            type="button"
            onClick={() => playTracks(pool, track.id)}
            aria-label={`Play ${track.title}`}
            className="relative"
          >
            <Artwork src={art} alt="" className="h-9 w-9 group-hover:hidden" radius="rounded" />
            <span className="absolute inset-0 hidden place-items-center rounded-md bg-black/45 group-hover:grid">
              <Play className="h-4 w-4 fill-white text-white" strokeWidth={0} />
            </span>
          </button>
        )}
        {!showArtwork && (
          <>
            <span className="text-xs tabular-nums text-tertiary transition-opacity group-hover:opacity-0">
              {isCurrent && playing ? <MiniEq /> : String(track.track_number ?? '').padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => playTracks(pool, track.id)}
              aria-label={`Play ${track.title}`}
              className="absolute inset-0 grid place-items-center rounded text-default opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Play className="h-4 w-4 fill-current" strokeWidth={0} />
            </button>
          </>
        )}
      </div>

      {/* Title */}
      <button
        type="button"
        onClick={() => playTracks(pool, track.id)}
        className={`min-w-0 flex-1 text-left text-[13.5px] ${
          isCurrent ? 'font-semibold text-accent' : 'text-default'
        }`}
      >
        <span className="block truncate">{track.title}</span>
      </button>

      {/* Optional artist / album columns */}
      {showArtist && (
        <span className="hidden w-44 shrink-0 truncate text-[12.5px] text-secondary md:block">
          {track.artist ?? 'Unknown Artist'}
        </span>
      )}
      {showAlbum && (
        <span className="hidden w-48 shrink-0 truncate text-[12.5px] text-secondary lg:block">
          {track.album ?? ''}
        </span>
      )}

      {/* Favorite */}
      <button
        type="button"
        onClick={() => void handleFavorite()}
        aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-tertiary transition-all hover:text-accent ${
          fav ? 'text-accent' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <Heart className="h-4 w-4" strokeWidth={1.9} fill={fav ? 'currentColor' : 'none'} />
      </button>

      {/* Duration */}
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-tertiary">
        {formatDuration(track.duration)}
      </span>

      {/* Menu */}
      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <Menu items={menuItems} ariaLabel={`Actions for ${track.title}`} />
      </div>
    </div>
  );
}

/** Tiny animated equalizer for the current row. */
function MiniEq() {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[0.6, 1, 0.75].map((_, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-accent"
          style={{ height: '100%', animation: `eq 0.8s ease-in-out ${i * 0.15}s infinite alternate` }}
        />
      ))}
    </span>
  );
}