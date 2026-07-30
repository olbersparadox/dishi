import { MenuBookIcon, CameraIcon } from 'dishi';

// An open menu booklet — pairs with CameraIcon on the scan page's ink dropzone
// to say "photograph a menu" specifically, not just "take a photo". The only
// real home is that pairing, at size 59 next to the camera's 42.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <MenuBookIcon size={20} />
      <MenuBookIcon size={30} />
      <MenuBookIcon size={42} />
      <MenuBookIcon size={59} />
    </div>
  );
}

/** The scan page's ink dropzone banner, exactly as scan/page.tsx composes it —
 *  camera + menu-book pair, white on black. */
export function ScanDropzone() {
  return (
    <div style={{ padding: 24 }}>
      <div className="photo-picker" style={{ height: 112, padding: '0 16px', background: 'var(--ink)', border: '1px solid var(--ink)', color: 'var(--glaze)' }}>
        <div className="scan-dropzone-content">
          <span className="scan-dropzone-icons">
            <CameraIcon size={42} strokeWidth={1.1} />
            <MenuBookIcon size={59} />
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subtitle-a)' }}>掃描菜單</span>
        </div>
      </div>
    </div>
  );
}
