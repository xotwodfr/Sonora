import { NavLink } from 'react-router-dom';
import {
  AudioLines,
  Clock3,
  Disc3,
  Heart,
  ListMusic,
  ListPlus,
  Menu,
  Music2,
  Shapes,
  Settings,
  Waves,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useEffect } from 'react';

const PRIMARY_NAV = [
  { to: '/', label: 'Listen Now', icon: Waves, end: true },
  { to: '/recent', label: 'Recently Added', icon: Clock3 },
  { to: '/artists', label: 'Artists', icon: AudioLines },
  { to: '/albums', label: 'Albums', icon: Disc3 },
  { to: '/songs', label: 'Songs', icon: Music2 },
  { to: '/genres', label: 'Genres', icon: Shapes },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebar = useUIStore((s) => s.setSidebar);
  const playlists = useLibraryStore((s) => s.playlists);
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists);
  const playlistsLoaded = useLibraryStore((s) => s.playlistsLoaded);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  return (
    <aside
      className={`sidebar glass-backdrop relative z-30 flex flex-col border-r border-[var(--glass-border)] bg-[var(--bg)]/70 ${
        collapsed ? 'w-[4.5rem]' : 'w-60'
      } transition-[width] duration-300 ease-glass`}
      aria-label="Sidebar"
    >
      {/* Brand */}
      <div className={`flex h-14 items-center gap-2.5 px-4 ${collapsed ? 'justify-center px-0' : ''}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#ff6b6b] to-[#ff9f68] shadow-lg shadow-accent/30">
              <Waves className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
            </div>
            <span className="text-[17px] font-bold tracking-tight">Sonora</span>
          </div>
        )}
        {collapsed && (
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff6b6b] to-[#ff9f68] shadow-lg shadow-accent/30">
            <Waves className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Primary">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={item.end ? 2 : 1.9} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Playlists */}
        {!collapsed && (
          <>
            <div className="mt-5 mb-1 flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                Playlists
              </span>
              <button
                type="button"
                onClick={() => void createPlaylist()}
                aria-label="Create playlist"
                className="glass-control h-6 w-6 rounded-md"
              >
                <ListPlus className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {playlists.map((p) => (
                <li key={p.id}>
                  <NavLink
                    to={`/playlists/${p.id}`}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'active' : ''} ${p.track_count === 0 ? 'opacity-70' : ''}`
                    }
                  >
                    <ListMusic className="h-[18px] w-[18px] shrink-0 text-secondary" strokeWidth={1.8} />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[11px] tabular-nums text-tertiary">{p.track_count}</span>
                  </NavLink>
                </li>
              ))}
              {playlists.length === 0 && playlistsLoaded && (
                <li className="px-3 py-1 text-xs text-tertiary">No playlists yet</li>
              )}
            </ul>
          </>
        )}
      </nav>

      {/* Footer: collapse toggle */}
      <div className="border-t border-[var(--glass-border)] p-2">
        <button
          type="button"
          onClick={() => setSidebar(!collapsed)}
          className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}