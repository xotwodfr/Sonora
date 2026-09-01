/** Skeleton block used while data is loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton animate-pulse ${className}`} aria-hidden />;
}

/** A grid of card skeletons sized for album/artist grids. */
export function CardSkeletons({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/2 rounded-md" />
        </div>
      ))}
    </div>
  );
}