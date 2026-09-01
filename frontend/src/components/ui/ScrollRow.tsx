import type { ReactNode } from 'react';

/** A horizontally-scrollable, snapping row of cards (replaces flex-wrap overflow). */
export function ScrollRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 ${className}`}
      role="list"
    >
      {children}
    </div>
  );
}

/** Fixed-width slot so cards don't shrink in a ScrollRow. */
export function RowSlot({ children }: { children: ReactNode }) {
  return (
    <div role="listitem" className="w-[150px] shrink-0 snap-start sm:w-[162px] md:w-[172px]">
      {children}
    </div>
  );
}