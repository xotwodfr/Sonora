/**
 * Color extraction from album artwork.
 * Uses canvas to sample pixels and generate a harmonious palette.
 */

export interface AlbumPalette {
  /** Primary accent color derived from the artwork */
  accent: string;
  /** Secondary accent color */
  accentSecondary: string;
  /** Dominant background color (darkened) */
  background: string;
  /** Elevated surface color */
  surface: string;
  /** Whether this palette is valid */
  valid: boolean;
}

// Cache: artwork URL → palette
const paletteCache = new Map<string, AlbumPalette>();

// Canvas and context reused across extractions
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function getCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (canvas && ctx) return { canvas, ctx };
  canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas context');
  return { canvas, ctx };
}

/** Convert RGB to HSL. Returns [h, s, l] with h in 0-360, s/l in 0-100. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

/** Convert HSL to RGB. h in 0-360, s/l in 0-100. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbString(r: number, g: number, b: number): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function hslString(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/**
 * Extract a palette from an image URL.
 * Returns a cached result if available.
 */
export async function extractPalette(imageUrl: string): Promise<AlbumPalette> {
  const cached = paletteCache.get(imageUrl);
  if (cached) return cached;

  try {
    const { ctx: cx } = getCanvas();
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });

    cx.drawImage(img, 0, 0, 64, 64);
    const imageData = cx.getImageData(0, 0, 64, 64).data;

    // Sample pixels and compute average color
    let totalR = 0, totalG = 0, totalB = 0;
    let count = 0;

    // Also collect colors for finding the dominant hue
    const colors: Array<[number, number, number]> = [];

    for (let i = 0; i < imageData.length; i += 16) { // Sample every 4th pixel
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];
      if (a < 128) continue; // Skip transparent

      totalR += r;
      totalG += g;
      totalB += b;
      count++;
      colors.push([r, g, b]);
    }

    if (count === 0) {
      const fallback: AlbumPalette = {
        accent: 'rgb(255, 107, 107)',
        accentSecondary: 'rgb(255, 159, 104)',
        background: 'rgb(11, 11, 15)',
        surface: 'rgb(26, 26, 33)',
        valid: false,
      };
      paletteCache.set(imageUrl, fallback);
      return fallback;
    }

    // Average color
    const avgR = Math.round(totalR / count);
    const avgG = Math.round(totalG / count);
    const avgB = Math.round(totalB / count);

    // Find the most saturated, bright color from samples
    let bestSat = 0;
    let bestH = 0;
    let bestS = 0;
    let bestL = 0;

    for (const [r, g, b] of colors) {
      const [h, s, l] = rgbToHsl(r, g, b);
      // Prefer saturated colors with mid-range lightness
      const score = s * (l > 20 && l < 80 ? 1 : 0.5);
      if (score > bestSat) {
        bestSat = score;
        bestH = h;
        bestS = s;
        bestL = l;
      }
    }

    // Generate accent: desaturated and adjusted for UI use
    const accentS = Math.min(bestS, 65); // Cap saturation
    const accentL = Math.max(45, Math.min(60, bestL)); // Mid-range lightness
    const accent = hslString(bestH, accentS, accentL);

    // Secondary accent: shift hue slightly
    const secondaryH = (bestH + 25) % 360;
    const accentSecondary = hslString(secondaryH, Math.min(accentS, 55), accentL + 5);

    // Background: darken the average significantly
    const [bgH, bgS] = rgbToHsl(avgR, avgG, avgB);
    const bgRgb = hslToRgb(bgH, Math.min(bgS * 0.5, 20), 6); // Very dark, slightly colored
    const background = rgbString(...bgRgb);

    // Surface: slightly lighter than background
    const surfaceRgb = hslToRgb(bgH, Math.min(bgS * 0.4, 15), 11);
    const surface = rgbString(...surfaceRgb);

    const palette: AlbumPalette = {
      accent,
      accentSecondary,
      background,
      surface,
      valid: true,
    };

    paletteCache.set(imageUrl, palette);
    return palette;
  } catch {
    const fallback: AlbumPalette = {
      accent: 'rgb(255, 107, 107)',
      accentSecondary: 'rgb(255, 159, 104)',
      background: 'rgb(11, 11, 15)',
      surface: 'rgb(26, 26, 33)',
      valid: false,
    };
    paletteCache.set(imageUrl, fallback);
    return fallback;
  }
}

/** Clear the palette cache (e.g., on logout or memory pressure). */
export function clearPaletteCache(): void {
  paletteCache.clear();
}
