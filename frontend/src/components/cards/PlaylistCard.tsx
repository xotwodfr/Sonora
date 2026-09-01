import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { api } from '../../lib/api';
import { usePlayerStore } from '../../stores/playerStore';
import type { Playlist } from '../../lib/types';
import { Artwork } from '../ui/Artwork';

/** Playlist card — glass sheet with the counted list icon. */
export function PlaylistCard({ playlist, index = 0 }: { playlist: Playlist; index?: number }) {
  const navigate = useNavigate();
  const go = () => navigate(`/playlists/${playlist.id}`);

  const play = async () => {
    try {
      const detail = await api.getPlaylist(playlist.id);
      usePlayerStore.getState().playTracks(detail.tracks ?? []);
    } catch {
      /* ignored */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className="group cursor-pointer select-none"
      onClick={go}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl">
        <Artwork src={null} alt={playlist.name} radius="none" className="h-full w-full" icon={MusicGlyph} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/25 group-hover:opacity-100">
          <motion.button
            type="button"
            aria-label={`Play ${playlist.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void play();
            }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            className="glass-strong grid h-[52px] w-[52px] place-items-center rounded-full text-default"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={0} />
          </motion.button>
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-[13.5px] font-semibold transition-colors group-hover:text-accent">
          {playlist.name}
        </p>
        <p className="text-xs text-secondary">
          {playlist.track_count} song{playlist.track_count === 1 ? '' : 's'}
        </p>
      </div>
    </motion.div>
  );
}

function MusicGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--surface-2)" />
      <path
        d="M9.5 15.5v-5l5.5-1.4v5"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.2" cy="15.8" r="1.3" fill="var(--accent)" />
      <circle cx="13.7" cy="14.4" r="1.3" fill="var(--accent)" />
    </svg>
  );
}