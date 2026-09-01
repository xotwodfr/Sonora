import { createContext, useContext } from 'react';

/** Provides the shared main-content scroll element for virtualized pages. */
export const ScrollContext = createContext<HTMLDivElement | null>(null);

export function useScrollContainer(): HTMLDivElement | null {
  return useContext(ScrollContext);
}