import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AudioLines } from 'lucide-react';
import type { Artist } from '../../lib/types';

/** Monogram color derived from the name — cheerful, unique per artist. */
function monogramColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 65% 52%), hsl(${(h + 40) % 360} 70% 44%))`;
}

export function ArtistCard({ artist, index = 0 }: { artist: Artist; index?: number }) {
  const navigate = useNavigate();
  const go = () => navigate(`/artists/${artist.id}`);

  return (
    <motion.button
      type="button"
      onClick={go}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className="group cursor-pointer select-none text-left"
    >
      <div
        className="mx-auto grid aspect-square w-4/5 place-items-center rounded-full text-white shadow-lg"
        style={{ background: monogramColor(artist.name) }}
      >
        <AudioLines className="h-1/3 w-1/3 opacity-80" strokeWidth={1.4} />
      </div>
      <div className="mt-2.5 px-0.5 text-center">
        <p className="truncate text-[13.5px] font-semibold transition-colors group-hover:text-accent">
          {artist.name}
        </p>
        <p className="text-xs text-secondary">
          {artist.album_count} album{artist.album_count === 1 ? '' : 's'}
        </p>
      </div>
    </motion.button>
  );
}