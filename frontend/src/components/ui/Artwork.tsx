import { useState } from 'react';
import { Music2, type LucideIcon } from 'lucide-react';

interface ArtworkProps {
  src?: string | null;
  alt?: string;
  className?: string;
  radius?: 'rounded' | 'circle' | 'none';
  /** icon used on the placeholder — defaults to a music glyph */
  icon?: LucideIcon | React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

/**
 * Artwork image with a graceful gradient placeholder. Shared everywhere so the
 * fallback look stays consistent (no broken-image icons anywhere).
 */
export function Artwork({
  src,
  alt = '',
  className = '',
  radius = 'rounded',
  icon: Icon = Music2,
}: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  const radiusClass =
    radius === 'circle' ? 'rounded-full' : radius === 'none' ? 'rounded-none' : 'rounded-lg';

  return (
    <div
      className={`relative overflow-hidden ${radiusClass} ${className} ${
        showImg ? '' : 'artwork-fallback'
      }`}
      aria-hidden={!showImg}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Icon className="h-1/3 w-1/3 text-gray-400/70" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}