'use client';
// Read EXIF off a user's ORIGINAL photo file — GPS (where it was taken) and the
// capture timestamp (when) — client-side, before normalizePhoto re-encodes through
// a canvas and strips it. exifr reads the file bytes, so HEIC (iPhone originals)
// works without decoding the image.
//
// Everything fails soft: photos stripped at the source (share sheets, screenshots,
// location-off, in-app camera captures) simply have nothing to read, and the caller
// falls back to live GPS / the manual picker. This is a prefill, never a dependency.
import exifr from 'exifr';

export type PhotoMeta = {
  /** Where the photo was taken — the restaurant, not where the phone is now. */
  coords: { lat: number; lng: number } | null;
  /** When the photo was taken — the eaten-date (Phase 2). Survives stripping more
   *  often than GPS. */
  takenAt: Date | null;
};

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  let coords: PhotoMeta['coords'] = null;
  let takenAt: PhotoMeta['takenAt'] = null;

  try {
    const gps = await exifr.gps(file); // { latitude, longitude } | undefined
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      coords = { lat: gps.latitude, lng: gps.longitude };
    }
  } catch { /* no / unreadable GPS — expected for many photos */ }

  try {
    const parsed = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
    const d = parsed?.DateTimeOriginal ?? parsed?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) takenAt = d;
  } catch { /* no / unreadable timestamp — fine */ }

  return { coords, takenAt };
}
