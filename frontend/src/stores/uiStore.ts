import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  queueOpen: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
}

/** Apply the theme class to <html> (dark/light). */
function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove('theme-dark', 'theme-light');
  root.classList.add(t === 'dark' ? 'theme-dark' : 'theme-light');
  root.style.colorScheme = t;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      searchOpen: false,
      queueOpen: false,
      setTheme: (t) => {
        applyTheme(t);
        set({ theme: t });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (v) => set({ sidebarCollapsed: v }),
      setSearchOpen: (v) => set({ searchOpen: v }),
      setQueueOpen: (v) => set({ queueOpen: v }),
    }),
    {
      name: 'sonora-ui',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
