import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { api, albumArtworkUrl } from '../../lib/api';
import { usePlayerStore } from '../../stores/playerStore';
import type { Album } from '../../lib/types';
import { Artwork } from '../ui/Artwork';

/** Album card: square artwork, hover play button, click → album page. */
export function AlbumCard({ album, index = 0 }: { album: Album; index?: number }) {
  const navigate = useNavigate();
  const [playing, setPlaying] = useState(false);

  const go = () => navigate(`/albums/${album.id}`);

  const play = async () => {
    if (playing) return;
    setPlaying(true);
    try {
      const detail = await api.getAlbum(album.id);
      usePlayerStore.getState().playTracks(detail.tracks ?? []);
    } finally {
      setPlaying(false);
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
        <Artwork src={albumArtworkUrl(album)} alt={album.title} className="h-full w-full" radius="none" />
        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/25 group-hover:opacity-100">
          <motion.button
            type="button"
            aria-label={`Play ${album.title}`}
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
        <p className="truncate text-[13.5px] font-semibold text-default transition-colors group-hover:text-accent">
          {album.title}
        </p>
        <p className="truncate text-xs text-secondary">{album.album_artist ?? 'Various Artists'}</p>
        {album.year ? <p className="text-[11px] text-tertiary">{album.year}</p> : null}
      </div>
    </motion.div>
  );
}