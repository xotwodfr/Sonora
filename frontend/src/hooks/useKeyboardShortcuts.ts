import { useEffect } from 'react';

/** Global keyboard shortcuts (media keys handled via the Media Session API). */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        // Toggled by the store; dispatch a DOM event the shell listens for.
        window.dispatchEvent(new CustomEvent('sonora:toggle-search'));
      } else if (mod && e.key === 'ArrowRight') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sonora:next'));
      } else if (mod && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sonora:prev'));
      } else if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sonora:playpause'));
      } else if (mod && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sonora:toggle-theme'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}