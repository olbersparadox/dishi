'use client';

/**
 * Downscale + normalize any user photo to a JPEG before upload.
 *
 * This solves three real problems at once:
 *  1. Size — a modern phone photo is 8-10MB; serverless request bodies have limits
 *     (Vercel: ~4.5MB) and vision tokens cost by size. 1600px is plenty for both
 *     dish recognition and menu text.
 *  2. Format — iPhones often hand the browser HEIC, which the vision API rejects.
 *     Canvas re-encoding always outputs JPEG regardless of input format.
 *  3. Missing/odd MIME types — some mobile browsers report an empty type on camera
 *     capture; the output here is always a well-formed image/jpeg File.
 *
 * Falls back to the original file only if decoding fails entirely (in which case
 * the server-side type guard is the next line of defense).
 */
export async function normalizePhoto(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
