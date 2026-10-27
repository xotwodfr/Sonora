import { create } from 'zustand';
import { extractPalette, hslToRgb, type AlbumPalette } from '../lib/colorExtract';
import { usePlayerStore } from './playerStore';
import { useSettingsStore } from './settingsStore';
import { artworkUrl } from '../lib/api';

interface ThemeState {
  /** Current active palette from album art */
  currentPalette: AlbumPalette | null;
  /** Whether dynamic theming is active */
  dynamicActive: boolean;
  /** Previous artwork URL to avoid re-extraction */
  previousArtworkUrl: string | null;
}

/**
 * Parse an rgb(), hsl() or #rrggbb string to extract [r, g, b] values.
 */
function parseColor(color: string): [number, number, number] | null {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }
  const hexMatch = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hexMatch) {
    return [parseInt(hexMatch[1], 16), parseInt(hexMatch[2], 16), parseInt(hexMatch[3], 16)];
  }
  const hslMatch = color.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
  if (hslMatch) {
    return hslToRgb(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]), parseFloat(hslMatch[3]));
  }
  return null;
}

/**
 * Lighten a color by a factor (0-1).
 */
function lightenColor(color: string, factor: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [r, g, b] = rgb;
  return `rgb(${Math.round(r + (255 - r) * factor)}, ${Math.round(g + (255 - g) * factor)}, ${Math.round(b + (255 - b) * factor)})`;
}

/**
 * Mix two colors.
 */
function mixColors(color1: string, color2: string, weight: number): string {
  const rgb1 = parseColor(color1);
  const rgb2 = parseColor(color2);
  if (!rgb1 || !rgb2) return color1;
  const [r1, g1, b1] = rgb1;
  const [r2, g2, b2] = rgb2;
  const w1 = 1 - weight;
  return `rgb(${Math.round(r1 * w1 + r2 * weight)}, ${Math.round(g1 * w1 + g2 * weight)}, ${Math.round(b1 * w1 + b2 * weight)})`;
}

/**
 * Apply a palette to CSS variables on :root.
 */
function applyPalette(palette: AlbumPalette, isLight: boolean): void {
  const root = document.documentElement;

  if (!palette.valid) {
    // Reset to defaults
    root.style.removeProperty('--dyn-accent');
    root.style.removeProperty('--dyn-accent-hover');
    root.style.removeProperty('--dyn-accent-soft');
    root.style.removeProperty('--dyn-bg');
    root.style.removeProperty('--dyn-surface');
    root.style.removeProperty('--dyn-surface-2');
    root.style.setProperty('--dynamic-active', '0');
    return;
  }

  const accent = palette.accent;
  const accentHover = lightenColor(accent, 0.15);
  const accentRgb = parseColor(accent);
  const accentSoft = accentRgb
    ? `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, ${isLight ? 0.1 : 0.16})`
    : 'rgba(255, 107, 107, 0.16)';

  let bg: string;
  let surface: string;
  let surface2: string;

  if (isLight) {
    // For light mode, use lighter versions
    bg = mixColors(palette.background, '#f2f2f6', 0.85);
    surface = mixColors(palette.surface, '#ffffff', 0.8);
    surface2 = mixColors(palette.surface, '#f0f0f4', 0.75);
  } else {
    bg = palette.background;
    surface = palette.surface;
    surface2 = lightenColor(palette.surface, 0.06);
  }

  root.style.setProperty('--dyn-accent', accent);
  root.style.setProperty('--dyn-accent-hover', accentHover);
  root.style.setProperty('--dyn-accent-soft', accentSoft);
  root.style.setProperty('--dyn-bg', bg);
  root.style.setProperty('--dyn-surface', surface);
  root.style.setProperty('--dyn-surface-2', surface2);
  root.style.setProperty('--dynamic-active', '1');
}

/**
 * Reset dynamic theme to defaults.
 */
function resetDynamicTheme(): void {
  const root = document.documentElement;
  root.style.removeProperty('--dyn-accent');
  root.style.removeProperty('--dyn-accent-hover');
  root.style.removeProperty('--dyn-accent-soft');
  root.style.removeProperty('--dyn-bg');
  root.style.removeProperty('--dyn-surface');
  root.style.removeProperty('--dyn-surface-2');
  root.style.setProperty('--dynamic-active', '0');
}

export const useThemeStore = create<ThemeState>()(() => ({
  currentPalette: null,
  dynamicActive: false,
  previousArtworkUrl: null,
}));

/**
 * Initialize the dynamic theme system.
 * Subscribes to player track changes and applies dynamic theming.
 */
let initialized = false;

export function initDynamicTheme(): void {
  if (initialized) return;
  initialized = true;

  // Subscribe to player track changes
  usePlayerStore.subscribe((state, prevState) => {
    const track = state.current;
    const prevTrack = prevState.current;

    // Only re-extract when track changes
    if (track?.id === prevTrack?.id) return;

    const settings = useSettingsStore.getState();
    if (!settings.appearance.dynamicAlbumColors) {
      useThemeStore.setState({ dynamicActive: false, currentPalette: null });
      resetDynamicTheme();
      return;
    }

    const artUrl = artworkUrl(track);
    if (!artUrl) {
      useThemeStore.setState({ dynamicActive: false, currentPalette: null });
      resetDynamicTheme();
      return;
    }

    const cached = useThemeStore.getState();
    if (artUrl === cached.previousArtworkUrl) return;

    useThemeStore.setState({ previousArtworkUrl: artUrl });

    // Extract palette asynchronously
    extractPalette(artUrl).then((palette) => {
      // Only apply if this is still the current artwork
      const currentArt = artworkUrl(usePlayerStore.getState().current);
      if (currentArt !== artUrl) return;

      const isLight = useUIStore?.getState?.()?.theme === 'light';
      applyPalette(palette, isLight);
      useThemeStore.setState({ currentPalette: palette, dynamicActive: palette.valid });
    });
  });

  // Subscribe to settings changes
  useSettingsStore.subscribe((state, prevState) => {
    if (state.appearance.dynamicAlbumColors === prevState.appearance.dynamicAlbumColors) return;

    if (!state.appearance.dynamicAlbumColors) {
      useThemeStore.setState({ dynamicActive: false, currentPalette: null });
      resetDynamicTheme();
    } else {
      // Re-apply if there's a current track
      const track = usePlayerStore.getState().current;
      if (!track) return;
      const artUrl = artworkUrl(track);
      if (!artUrl) return;

      extractPalette(artUrl).then((palette) => {
        const isLight = useUIStore?.getState?.()?.theme === 'light';
        applyPalette(palette, isLight);
        useThemeStore.setState({ currentPalette: palette, dynamicActive: palette.valid });
      });
    }
  });
}

// Lazy import to avoid circular dependency
let useUIStore: typeof import('./uiStore').useUIStore | null = null;
import('./uiStore').then((mod) => {
  useUIStore = mod.useUIStore;

  // Subscribe to theme changes to re-apply dynamic palette
  useUIStore.subscribe((state, prevState) => {
    if (state.theme === prevState.theme) return;
    const palette = useThemeStore.getState().currentPalette;
    if (palette?.valid) {
      applyPalette(palette, state.theme === 'light');
    }
  });
});
