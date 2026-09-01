import { useEffect, useState, type ReactNode } from 'react';
import { useScrollContainer } from '../layout/ScrollContext';

interface VirtualListProps<T> {
  items: T[];
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Lightweight fixed-height virtual list that scrolls with the shared content
 * container (AppShell's scroll region). Only the visible slice + overscan is
 * rendered — cheap even for tens of thousands of tracks.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  overscan = 12,
  className = '',
  ariaLabel = 'Tracks',
}: VirtualListProps<T>) {
  const scrollEl = useScrollContainer();
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  useEffect(() => {
    const el = scrollEl ?? document.documentElement;
    const update = () => {
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight || 800);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [scrollEl]);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  const visible = items.slice(start, end);

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      className={`relative ${className}`}
      style={{ height: items.length * rowHeight }}
    >
      <div
        className="absolute left-0 right-0 top-0"
        style={{ transform: `translateY(${start * rowHeight}px)` }}
      >
        {visible.map((item, i) => (
          <div key={i} role="listitem" style={{ height: rowHeight }}>
            {renderRow(item, start + i)}
          </div>
        ))}
      </div>
    </div>
  );
}