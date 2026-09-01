import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shuffle, Disc3, Heart, Clock3, type LucideIcon } from 'lucide-react';
import { useLibraryStore } from '../stores/libraryStore';
import { usePlayerStore } from '../stores/playerStore';
import { api } from '../lib/api';
import { formatCount, formatLength } from '../lib/format';
import { PageHeader, SectionHeader } from '../components/ui/PageHeader';
import { ScrollRow, RowSlot } from '../components/ui/ScrollRow';
import { AlbumCard } from '../components/cards/AlbumCard';
import { ArtistCard } from '../components/cards/ArtistCard';
import { PlaylistCard } from '../components/cards/PlaylistCard';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import type { Album } from '../lib/types';

export function ListenNow() {
  const status = useLibraryStore((s) => s.status);
  const albums = useLibraryStore((s) => s.albums);
  const albumsLoaded = useLibraryStore((s) => s.albumsLoaded);
  const loadAlbums = useLibraryStore((s) => s.loadAlbums);
  const artists = useLibraryStore((s) => s.artists);
  const artistsLoaded = useLibraryStore((s) => s.artistsLoaded);
  const loadArtists = useLibraryStore((s) => s.loadArtists);
  const playlists = useLibraryStore((s) => s.playlists);
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const loadRecentlyPlayed = useLibraryStore((s) => s.loadRecentlyPlayed);
  const loadFavorites = useLibraryStore((s) => s.loadFavorites);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const setShuffle = usePlayerStore((s) => s.setShuffle);

  useEffect(() => {
    loadAlbums();
    loadArtists();
    loadPlaylists();
    loadRecentlyPlayed();
    loadFavorites();
  }, [loadAlbums, loadArtists, loadPlaylists, loadRecentlyPlayed, loadFavorites]);

  // Recently played → unique albums (resolved against the albums store so the
  // artwork + artist metadata are real).
  const albumById = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums]);
  const recentAlbums: Album[] = useMemo(() => {
    const seen = new Set<number>();
    const out: Album[] = [];
    for (const t of recentlyPlayed) {
      if (t.album_id != null && !seen.has(t.album_id)) {
        seen.add(t.album_id);
        const full = albumById.get(t.album_id);
        out.push(
          full ?? {
            id: t.album_id,
            title: t.album ?? t.title,
            album_artist: t.artist ?? null,
            year: t.year ?? null,
            total_tracks: null,
            total_discs: null,
            artwork_path: null,
            track_count: 1,
            artist_count: 1,
            total_duration: t.duration ?? 0,
          },
        );
      }
    }
    return out.slice(0, 18);
  }, [recentlyPlayed, albumById]);

  const playLibrary = async () => {
    try {
      const res = await api.getTracks({ limit: 10000, sort: 'title' });
      const tracks = res.data;
      if (tracks.length === 0) return;
      setShuffle(false); // establish natural order
      playTracks(tracks);
      setShuffle(true); // then shuffle, keeping the first track current
    } catch {
      /* no-op */
    }
  };

  const ready = albumsLoaded && artistsLoaded;
  const empty = ready && (status?.tracks ?? 0) === 0;

  if (!ready) {
    return (
      <div>
        <PageHeader title="Listen Now" />
        <SectionHeader title="Recently Played" />
        <CardSkeletons count={6} />
        <SectionHeader title="New Releases" />
        <CardSkeletons count={6} />
      </div>
    );
  }

  if (empty) {
    return (
      <div>
        <PageHeader title="Listen Now" />
        <EmptyState
          icon={Disc3}
          title="Your library is empty"
          message="Point Sonora's server at a folder of music (/music in Docker), then press the rescan button in the header — everything will appear here."
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <PageHeader
        title="Listen Now"
        subtitle={
          status
            ? `${formatCount(status.albums, 'album')} · ${formatCount(status.artists, 'artist')} · ${formatLength(status.tracks * 120)} of music`
            : undefined
        }
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative mb-4 overflow-hidden rounded-2xl border border-[var(--glass-border)] p-6 sm:p-8"
        style={{
          background:
            'radial-gradient(900px 320px at 20% -10%, rgba(255,107,107,0.35), transparent 55%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        }}
      >
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
              Your library
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {status?.tracks ? formatCount(status.tracks) : 'Sonora'}
            </h2>
            <p className="mt-2 text-sm text-secondary">
              {status
                ? `${formatCount(status.albums, 'album')} · ${formatCount(status.artists, 'artist')}`
                : 'Your music, beautifully organized.'}
            </p>
          </div>
          <button type="button" onClick={() => void playLibrary()} className="btn-accent">
            <Shuffle className="h-4 w-4" strokeWidth={2} />
            Play Library
          </button>
        </div>
      </motion.div>

      {/* Recently Played */}
      {recentAlbums.length > 0 && (
        <>
          <SectionHeader
            title="Recently Played"
            action={
              <Link to="/recent" className="text-sm text-secondary transition-colors hover:text-accent">
                See All
              </Link>
            }
          />
          <ScrollRow>
            {recentAlbums.map((a, i) => (
              <RowSlot key={a.id}>
                <AlbumCard album={a} index={i} />
              </RowSlot>
            ))}
          </ScrollRow>
        </>
      )}

      {/* New releases */}
      {albums.length > 0 && (
        <>
          <SectionHeader
            title="Albums"
            action={
              <Link to="/albums" className="text-sm text-secondary transition-colors hover:text-accent">
                See All
              </Link>
            }
          />
          <ScrollRow>
            {albums.slice(0, 14).map((a, i) => (
              <RowSlot key={a.id}>
                <AlbumCard album={a} index={i} />
              </RowSlot>
            ))}
          </ScrollRow>
        </>
      )}

      {/* Artists */}
      {artists.length > 0 && (
        <>
          <SectionHeader
            title="Artists"
            action={
              <Link to="/artists" className="text-sm text-secondary transition-colors hover:text-accent">
                See All
              </Link>
            }
          />
          <ScrollRow>
            {artists.slice(0, 12).map((a, i) => (
              <RowSlot key={a.id}>
                <ArtistCard artist={a} index={i} />
              </RowSlot>
            ))}
          </ScrollRow>
        </>
      )}

      {/* Playlists */}
      {playlists.length > 0 && (
        <>
          <SectionHeader
            title="Playlists"
            action={
              <Link to="/playlists" className="text-sm text-secondary transition-colors hover:text-accent">
                See All
              </Link>
            }
          />
          <ScrollRow>
            {playlists.map((p, i) => (
              <RowSlot key={p.id}>
                <PlaylistCard playlist={p} index={i} />
              </RowSlot>
            ))}
          </ScrollRow>
        </>
      )}

      {/* Quick stats */}
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <StatCard icon={Clock3} label="Recently played" value={String(recentlyPlayed.length)} />
        <StatCard icon={Disc3} label="Albums" value={String(status?.albums ?? 0)} />
        <StatCard icon={Heart} label="Favorites" value={String(status?.favorites ?? 0)} />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="glass flex items-center gap-3 rounded-xl p-4">
      <div className="glass-control h-9 w-9">
        <Icon className="h-4 w-4 text-accent" strokeWidth={1.9} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{value || '0'}</p>
        <p className="text-xs text-secondary">{label}</p>
      </div>
    </div>
  );
}