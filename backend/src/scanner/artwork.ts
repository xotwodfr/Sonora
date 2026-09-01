import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import config from '../config.js';

/**
 * Embedded artwork cache. Artwork is extracted once per unique content hash
 * and written to DATA_PATH/artwork-cache/<hash>.<ext>. The hash also doubles as
 * the response key, so unchanged files never re-write artwork.
 */
export function cacheArtwork(buffer: Buffer): { path: string; hash: string } | null {
  if (!buffer || buffer.length === 0) return null;
  const hash = crypto.createHash('sha1').update(buffer).digest('hex');
  const ext = sniffImageExt(buffer);
  const filePath = path.join(config.artworkPath, `${hash}.${ext}`);
  if (fs.existsSync(filePath)) {
    return { path: filePath, hash };
  }
  try {
    fs.writeFileSync(filePath, buffer);
  } catch {
    return null;
  }
  return { path: filePath, hash };
}

function sniffImageExt(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF'
    && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  // GIF (87a / 89a)
  if (buf.length >= 6 && (buf.subarray(0, 4).toString('ascii') === 'GIF8')) return 'gif';
  // BMP
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
  return 'jpg';
}
