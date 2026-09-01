import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---- Settings types ----

export type LyricsMode = 'spicy' | 'classic' | 'karaoke' | 'minimal';

export type AnimationIntensity = 'full' | 'reduced' | 'off';

export type UiDensity = 'comfortable' | 'compact' | 'spacious';

export type PlayerView = 'default' | 'always-lyrics' | 'always-artwork';

export interface PlaybackSettings {
  streamBitrate: number;
  crossfadeDuration: number;
  gaplessPlayback: boolean;
  replayGain: boolean;
}

export interface LyricsSettings {
  mode: LyricsMode;
  synchronizedScrolling: boolean;
  autoFollow: boolean;
  textSize: number; // 0.75 to 1.5 (multiplier)
  animationIntensity: AnimationIntensity;
  showPreviousLines: boolean;
  showUpcomingLines: boolean;
  localLyricsFirst: boolean;
}

export interface AppearanceSettings {
  dynamicAlbumColors: boolean;
  animationIntensity: AnimationIntensity;
  glassEffects: boolean;
  uiDensity: UiDensity;
  artworkBlur: boolean;
}

export interface PlayerSettings {
  defaultView: PlayerView;
  showLyricsAutomatically: boolean;
  showArtwork: boolean;
  compactPlayerBehavior: 'minimal' | 'expanded';
  fullScreenBehavior: 'artwork' | 'lyrics' | 'split';
  queueBehavior: 'replace' | 'append';
}

export interface LibrarySettings {
  defaultSort: 'title' | 'artist' | 'album' | 'recent' | 'added';
  defaultView: 'grid' | 'list';
  showArtwork: boolean;
}

export interface PerformanceSettings {
  reduceAnimations: boolean;
  reduceVisualEffects: boolean;
  artworkCacheSize: number;
}

export interface SettingsState {
  playback: PlaybackSettings;
  lyrics: LyricsSettings;
  appearance: AppearanceSettings;
  player: PlayerSettings;
  library: LibrarySettings;
  performance: PerformanceSettings;

  // Actions
  updatePlayback: (patch: Partial<PlaybackSettings>) => void;
  updateLyrics: (patch: Partial<LyricsSettings>) => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  updatePlayer: (patch: Partial<PlayerSettings>) => void;
  updateLibrary: (patch: Partial<LibrarySettings>) => void;
  updatePerformance: (patch: Partial<PerformanceSettings>) => void;
  resetAll: () => void;
}

// ---- Defaults ----

const DEFAULTS = {
  playback: {
    streamBitrate: 320,
    crossfadeDuration: 0,
    gaplessPlayback: true,
    replayGain: false,
  },
  lyrics: {
    mode: 'spicy' as LyricsMode,
    synchronizedScrolling: true,
    autoFollow: true,
    textSize: 1,
    animationIntensity: 'full' as AnimationIntensity,
    showPreviousLines: true,
    showUpcomingLines: true,
    localLyricsFirst: false,
  },
  appearance: {
    dynamicAlbumColors: true,
    animationIntensity: 'full' as AnimationIntensity,
    glassEffects: true,
    uiDensity: 'comfortable' as UiDensity,
    artworkBlur: true,
  },
  player: {
    defaultView: 'default' as PlayerView,
    showLyricsAutomatically: false,
    showArtwork: true,
    compactPlayerBehavior: 'minimal' as const,
    fullScreenBehavior: 'split' as const,
    queueBehavior: 'replace' as const,
  },
  library: {
    defaultSort: 'recent' as const,
    defaultView: 'grid' as const,
    showArtwork: true,
  },
  performance: {
    reduceAnimations: false,
    reduceVisualEffects: false,
    artworkCacheSize: 50,
  },
};

// ---- Store ----

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      updatePlayback: (patch) =>
        set((s) => ({ playback: { ...s.playback, ...patch } })),

      updateLyrics: (patch) =>
        set((s) => ({ lyrics: { ...s.lyrics, ...patch } })),

      updateAppearance: (patch) =>
        set((s) => ({ appearance: { ...s.appearance, ...patch } })),

      updatePlayer: (patch) =>
        set((s) => ({ player: { ...s.player, ...patch } })),

      updateLibrary: (patch) =>
        set((s) => ({ library: { ...s.library, ...patch } })),

      updatePerformance: (patch) =>
        set((s) => ({ performance: { ...s.performance, ...patch } })),

      resetAll: () => set(DEFAULTS),
    }),
    {
      name: 'sonora-settings',
    },
  ),
);
