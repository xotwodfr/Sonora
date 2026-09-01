import { useEffect, useState } from 'react';
import { ListMusic, Plus } from 'lucide-react';
import { useLibraryStore } from '../stores/libraryStore';
import { PageHeader } from '../components/ui/PageHeader';
import { PlaylistCard } from '../components/cards/PlaylistCard';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function Playlists() {
  const playlists = useLibraryStore((s) => s.playlists);
  const playlistsLoaded = useLibraryStore((s) => s.playlistsLoaded);
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  if (!playlistsLoaded) return <CardSkeletons count={8} />;

  const submit = async () => {
    const trimmed = name.trim();
    setCreating(true);
    try {
      await createPlaylist(trimmed || 'New Playlist');
      setName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Playlists"
        subtitle={playlists.length > 0 ? `${playlists.length} playlist${playlists.length === 1 ? '' : 's'}` : undefined}
      />

      {/* Create row */}
      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New playlist name…"
          aria-label="New playlist name"
          className="glass-control h-9 max-w-xs flex-1 rounded-full px-4 text-sm outline-none placeholder:text-tertiary"
        />
        <button type="submit" disabled={creating} className="btn-accent h-9 px-4 text-sm">
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Create
        </button>
      </form>

      {playlists.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="No playlists yet"
          message="Create one above or add songs to a playlist from any track's ⋯ menu."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {playlists.map((p, i) => (
            <PlaylistCard key={p.id} playlist={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}