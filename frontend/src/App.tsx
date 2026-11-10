import { useEffect, useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { api, type AppSettings } from './lib/api';
import { Welcome } from './components/Welcome';
import { AppShell } from './components/layout/AppShell';
import { ListenNow } from './pages/ListenNow';
import { RecentlyAdded } from './pages/RecentlyAdded';
import { Albums } from './pages/Albums';
import { AlbumDetail } from './pages/AlbumDetail';
import { Artists } from './pages/Artists';
import { ArtistDetail } from './pages/ArtistDetail';
import { Songs } from './pages/Songs';
import { Genres } from './pages/Genres';
import { GenreDetail } from './pages/GenreDetail';
import { Playlists } from './pages/Playlists';
import { PlaylistDetail } from './pages/PlaylistDetail';
import { Favorites } from './pages/Favorites';
import { Settings } from './pages/Settings';

export default function App() {
  // First run: no music folder chosen yet. Show the welcome screen instead of an empty app.
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => setReady(true));
  }, []);
  if (settings && !settings.musicPath && !ready) {
    return <Welcome settings={settings} onReady={() => setReady(true)} />;
  }
  if (!settings && !ready) return null;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<ListenNow />} />
        <Route path="/recent" element={<RecentlyAdded />} />
        <Route path="/albums" element={<Albums />} />
        <Route path="/albums/:id" element={<AlbumDetail />} />
        <Route path="/artists" element={<Artists />} />
        <Route path="/artists/:id" element={<ArtistDetail />} />
        <Route path="/songs" element={<Songs />} />
        <Route path="/genres" element={<Genres />} />
        <Route path="/genres/:id" element={<GenreDetail />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/:id" element={<PlaylistDetail />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}