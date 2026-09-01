import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ListMusic, Pencil, Play, Shuffle, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { usePlayerStore } from '../stores/playerStore';
import { useLibraryStore } from '../stores/libraryStore';
import { formatCount, formatDate, formatDuration } from '../lib/format';
import type { Track } from '../lib/types';
import { SectionHeader } from '../components/ui/PageHeader';
import { TrackRow } from '../components/tracks/TrackRow';
import { Menu, type MenuItem } from '../components/ui/Menu';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';

export function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const playlistId = Number(id);

  const [playlist, setPlaylist] = useState<{ id: number; name: string; description: string | null; created_at: number } | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const playTracks = usePlayerStore((s) => s.playTracks);
  const touchPlaylists = useLibraryStore((s) => s.touchPlaylists);

  const load = useCallback(async () => {
    try {
      const detail = await api.getPlaylist(playlistId);
      setPlaylist({ id: detail.id, name: detail.name, description: detail.description, created_at: detail.created_at });
      setTracks((detail.tracks ?? []) as Track[]);
    } catch {
      setPlaylist(null);
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    setLoading(true);
    setTracks([]);
    setPlaylist(null);
    void load();
  }, [load]);

  const saveName = async () => {
    const name = draftName.trim();
    if (name && playlist) {
      await api.updatePlaylist(playlist.id, { name });
      await touchPlaylists();
      setPlaylist({ ...playlist, name });
    }
    setEditingName(false);
  };

  const reorder = async (from: number, to: number) => {
    if (to < 0 || to >= tracks.length) return;
    const next = [...tracks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTracks(next);
    try {
      await api.updatePlaylist(playlistId, { positions: next.map((t) => t.id) });
      await touchPlaylists();
    } catch {
      void load();
    }
  };

  const removeTrack = async (track: Track) => {
    await api.removeTrackFromPlaylist(playlistId, track.id);
    setTracks(tracks.filter((t) => t.id !== track.id));
    await touchPlaylists();
  };

  const removePlaylist = async () => {
    if (!confirm(`Delete playlist "${playlist?.name}"?`)) return;
    await api.deletePlaylist(playlistId);
    await touchPlaylists();
    navigate('/playlists');
  };

  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration ?? 0), 0);

  const menuItems: MenuItem[] = [
    {
      label: editingName ? 'Cancel' : 'Rename',
      icon: Pencil,
      onSelect: () => {
        setDraftName(playlist?.name ?? '');
        setEditingName((v) => !v);
      },
    },
    { label: 'Delete playlist', icon: Trash2, danger: true, onSelect: () => void removePlaylist() },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={28} />
      </div>
    );
  }

  if (!playlist) {
    return <EmptyState title="Playlist not found" message="This playlist may have been deleted." />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            Playlist
          </p>
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveName();
              }}
            >
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => void saveName()}
                className="glass-control h-10 w-full max-w-md rounded-lg px-3 text-xl font-bold outline-none"
                aria-label="Playlist name"
              />
            </form>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{playlist.name}</h1>
          )}
          <p className="mt-1 text-sm text-secondary">
            {formatCount(tracks.length, 'song')}
            {tracks.length > 0 ? ` · ${formatDuration(totalSeconds)}` : ''}
            {playlist.created_at ? ` · Created ${formatDate(playlist.created_at * 1000)}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" className="btn-accent !px-5 !py-2 text-sm" onClick={() => playTracks(tracks)}>
            <Play className="h-4 w-4 fill-current" strokeWidth={0} />
            Play
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" className="glass-control text-sm" onClick={() => {
            usePlayerStore.getState().setShuffle(false);
            playTracks(tracks);
            usePlayerStore.getState().setShuffle(true);
          }}>
            <Shuffle className="h-4 w-4" strokeWidth={1.9} />
            <span className="ml-1.5 hidden sm:inline">Shuffle</span>
          </motion.button>
          <Menu items={menuItems} ariaLabel="Playlist options" />
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="This playlist is empty"
          message="Add songs from any track's ⋯ menu by choosing “Add to playlist”."
        />
      ) : (
        <>
          <SectionHeader
            title="Songs"
            action={<span className="text-xs text-tertiary">{formatCount(tracks.length, 'song')}</span>}
          />
          <div className="flex flex-col gap-0.5">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                showAlbum
                onRemove={(t) => void removeTrack(t)}
                onMoveUp={() => void reorder(i, i - 1)}
                onMoveDown={() => void reorder(i, i + 1)}
                tracksForPlay={tracks}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}