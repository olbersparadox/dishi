// iPhones shoot HEIC by default, and Chrome/Firefox can't decode HEIC in an <img>
// — a picked .heic renders blank. Convert it to JPEG in the browser first.
//
// heic2any bundles a libheif wasm (~1.4MB), so it's loaded ONLY when a HEIC is
// actually picked (dynamic import) — the common JPEG/PNG path pays nothing. iOS
// Safari usually hands us a JPEG already (it transcodes on upload), so in practice
// this mostly kicks in on desktop.

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  // Some browsers report an empty MIME type for .heic/.heif — fall back to the name.
  return type === '' && /\.hei[cf]$/i.test(file.name);
}

/** Returns a browser-displayable File. HEIC → JPEG; everything else is passed
 *  through untouched. On conversion failure, returns the original (the caller
 *  shows a placeholder rather than crashing). */
export async function toDisplayable(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const heic2any = (await import('heic2any')).default;
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function toDisplayableAll(files: File[]): Promise<File[]> {
  return Promise.all(files.map(toDisplayable));
}
