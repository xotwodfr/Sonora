import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shapes } from 'lucide-react';
import { useLibraryStore } from '../stores/libraryStore';
import { formatCount } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const GENRE_GRADIENTS = [
  'linear-gradient(135deg, #ff6b6b, #c44569)',
  'linear-gradient(135deg, #f7b733, #fc4a1a)',
  'linear-gradient(135deg, #38ef7d, #11998e)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #f953c6, #b91d73)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f5af19, #f12711)',
];

export function Genres() {
  const genres = useLibraryStore((s) => s.genres);
  const genresLoaded = useLibraryStore((s) => s.genresLoaded);
  const loadGenres = useLibraryStore((s) => s.loadGenres);

  useEffect(() => {
    loadGenres();
  }, [loadGenres]);

  if (!genresLoaded) return <CardSkeletons count={8} />;

  return (
    <div>
      <PageHeader title="Genres" subtitle={genres.length > 0 ? formatCount(genres.length, 'genre') : undefined} />

      {genres.length === 0 ? (
        <EmptyState
          icon={Shapes}
          title="No genres yet"
          message="Genres are detected from your music files' ID3/FLAC tags."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {genres.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.3), ease: 'easeOut' }}
            >
              <Link
                to={`/genres/${g.id}`}
                className="group block overflow-hidden rounded-xl border border-[var(--glass-border)] shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="flex aspect-square items-end justify-between p-3"
                  style={{ background: GENRE_GRADIENTS[i % GENRE_GRADIENTS.length] }}
                >
                  <span className="text-lg font-bold tracking-tight text-white drop-shadow">
                    {g.name}
                  </span>
                  <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
                    {g.track_count}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}