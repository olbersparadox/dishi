import { PhotoPicker, ScanBenefitDemo, CameraIcon, MenuBookIcon } from 'dishi';

// The rotating miniature of what a menu scan RETURNS — translated name over
// the original menu script, ingredient chips, dishi's personalised pick. Its
// type is glaze-on-dark, so it is ONLY legible inside the inked scan banner:
// each cell mounts the real host, the scan page's PhotoPicker dropzone (the
// :has(.scan-dropzone-content) selector is what inks the banner), never the
// demo floating bare on paper. Capture freezes timers, so the first showcase
// dish (豚骨拉麵 over とんこつラーメン) is the one photographed; the rotation
// through the other scripts is runtime-only.

function Banner() {
  return (
    <div className="scan-dropzone-wrap">
      <PhotoPicker
        onPick={() => {}}
        hideLabel
        icon={
          <span className="scan-dropzone-content">
            <span className="scan-dropzone-icons">
              <CameraIcon size={42} strokeWidth={1.1} />
              <MenuBookIcon size={59} />
            </span>
            <ScanBenefitDemo />
          </span>
        }
      />
      <button type="button" className="card-info-badge" aria-label="有時真係唔知食乜好">i</button>
    </div>
  );
}

/** The scan page's primary action at the app's standard content width:
 *  camera + menu icons left, the live result mock right, ⓘ pinned to the
 *  banner's top-right. */
export function ScanBanner() {
  return <div style={{ maxWidth: 430 }}><Banner /></div>;
}

/** The same banner at a small phone's content width: the chip row is a
 *  flex-wrap container, so on the tightest screens the ✓ 啱你口味 pick drops
 *  to its own line and the fixed 112px banner still holds everything. */
export function ScanBannerNarrow() {
  return <div style={{ maxWidth: 340 }}><Banner /></div>;
}
