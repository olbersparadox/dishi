import { CameraIcon } from 'dishi';

// Camera — retake/replace a photo. Two real homes: the scan page's ink
// dropzone banner (paired with MenuBookIcon, white on black), and a tiny badge
// pinned to a pending pick's empty thumbnail (PickCardThumb).

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <CameraIcon size={16} />
      <CameraIcon size={20} />
      <CameraIcon size={26} />
      <CameraIcon size={40} />
    </div>
  );
}

/** The scan page's ink dropzone banner — white camera + menu-book pair on
 *  black, exactly as scan/page.tsx composes it. */
export function ScanDropzone() {
  return (
    <div style={{ padding: 24 }}>
      <div className="photo-picker" style={{ height: 112, padding: '0 16px', background: 'var(--ink)', border: '1px solid var(--ink)', color: 'var(--glaze)' }}>
        <div className="scan-dropzone-content">
          <span className="scan-dropzone-icons">
            <CameraIcon size={42} strokeWidth={1.1} />
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subtitle-a)' }}>影低張菜單</span>
        </div>
      </div>
    </div>
  );
}

/** PickCardThumb's tiny corner badge on an empty pending-pick thumbnail. */
export function PickThumbBadge() {
  return (
    <div style={{ padding: 24 }}>
      <div className="pick-card-thumb">
        <div className="pick-card-thumb-empty" />
        <label className="pick-card-cam" title="加相">
          <CameraIcon size={12} strokeWidth={2} />
        </label>
      </div>
    </div>
  );
}
