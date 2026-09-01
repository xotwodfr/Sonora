import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Disc3, Headphones, ListMusic, Search, Shapes, X } from 'lucide-react';
import { api, artworkUrl, albumArtworkUrl } from '../../lib/api';
import type { SearchResults } from '../../lib/types';
import { useUIStore } from '../../stores/uiStore';
import { usePlayerStore } from '../../stores/playerStore';
import { formatDuration } from '../../lib/format';
import { Artwork } from '../ui/Artwork';
import { Spinner } from '../ui/Spinner';

/** Global grouped search overlay (⌘K). */
export function SearchOverlay() {
  const open = useUIStore((s) => s.searchOpen);
  const setOpen = useUIStore((s) => s.setSearchOpen);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced fetch
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await api.search(q.trim()));
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    if (open) {
      setQ('');
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const goto = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const playTrack = (id: number) => {
    if (results?.tracks) playTracks(results.tracks, id);
  };

  const nonEmpty = results && (
    results.tracks.length + results.albums.length + results.artists.length +
    results.genres.length + results.playlists.length
  ) > 0;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Search your library"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/45"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="glass-strong mx-auto mt-[8vh] w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-[var(--glass-border)] px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-tertiary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Search songs, albums, artists, playlists…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-default outline-none placeholder:text-tertiary"
            aria-label="Search"
          />
          {loading && <Spinner size={16} className="text-tertiary" />}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="glass-control h-8 w-8">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!q.trim() && (
            <p className="px-3 py-10 text-center text-sm text-tertiary">
              Start typing to search across your whole library.
            </p>
          )}
          {q.trim().length >= 2 && !loading && results && !nonEmpty && (
            <p className="px-3 py-10 text-center text-sm text-tertiary">
              No results for “{q.trim()}”
            </p>
          )}

          {/* Tracks */}
          {results && results.tracks.length > 0 && (
            <section className="mb-2">
              <h3 className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                Songs
              </h3>
              {results.tracks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => playTrack(t.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--glass-fill-strong)]"
                >
                  <Artwork src={artworkUrl(t)} alt="" className="h-9 w-9 rounded-md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{t.title}</span>
                    <span className="block truncate text-[11px] text-secondary">{t.artist ?? 'Unknown Artist'}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-tertiary">
                    {formatDuration(t.duration)}
                  </span>
                </button>
              ))}
            </section>
          )}

          {/* Albums */}
          {results && results.albums.length > 0 && (
            <section className="mb-2">
              <h3 className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                Albums
              </h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {results.albums.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => goto(`/albums/${a.id}`)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--glass-fill-strong)]"
                  >
                    <Artwork
                      src={albumArtworkUrl(a)}
                      alt=""
                      icon={Disc3}
                      className="h-10 w-10 rounded-md"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{a.title}</span>
                      <span className="block truncate text-[11px] text-secondary">{a.album_artist ?? ''}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Artists */}
          {results && results.artists.length > 0 && (
            <section className="mb-2">
              <h3 className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                Artists
              </h3>
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {results.artists.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => goto(`/artists/${a.id}`)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--glass-fill-strong)]"
                  >
                    <Artwork src={null} alt="" icon={Headphones} radius="circle" className="h-9 w-9 rounded-full" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{a.name}</span>
                      <span className="block truncate text-[11px] text-secondary">
                        {a.album_count} album{a.album_count === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Genres */}
          {results && results.genres.length > 0 && (
            <section className="mb-2">
              <h3 className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                Genres
              </h3>
              <div className="flex flex-wrap gap-1.5 px-2">
                {results.genres.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => goto(`/genres/${g.id}`)}
                    className="glass-control h-8 rounded-full px-3 text-[13px]"
                  >
                    <Shapes className="mr-1.5 h-3.5 w-3.5 text-secondary" />
                    {g.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Playlists */}
          {results && results.playlists.length > 0 && (
            <section className="mb-1">
              <h3 className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                Playlists
              </h3>
              {results.playlists.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => goto(`/playlists/${p.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--glass-fill-strong)]"
                >
                  <Artwork src={null} alt="" icon={ListMusic} className="h-9 w-9 rounded-md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{p.name}</span>
                    <span className="block truncate text-[11px] text-secondary">
                      {p.track_count} song{p.track_count === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </motion.div>
  );
}