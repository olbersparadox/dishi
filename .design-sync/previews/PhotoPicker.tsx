import { PhotoPicker, CameraIcon, MenuBookIcon, ScanBenefitDemo } from 'dishi';

// The upload affordance that replaced the raw file input. The two live
// dressings: the quiet dashed default (owner menu import), and the scan page's
// INKED banner — a solid ink card with the icon pair and the rotating
// scan-benefit miniature, triggered by passing the .scan-dropzone-content
// composition as `icon` (ported verbatim from scan/page.tsx). The bare
// `hideLabel` variant is deliberately not shown: nothing currently mounts it
// without a custom icon, and unconstrained it fills its box with the arrow.

/** The quiet default: dashed border, upload arrow, stock bilingual copy
 *  (拍照或選擇相片) — as the owner menu-import card mounts it. */
export function DefaultUpload() {
  return (
    <div style={{ width: 360 }}>
      <PhotoPicker onPick={() => {}} />
    </div>
  );
}

/** The scan page's banner: camera + menu-book icons on the left, a miniature
 *  of what a scan returns on the right (translated name over the original
 *  script, ingredient chips, dishi's pick). The ink fill comes from globals.css
 *  keying on .scan-dropzone-content — the confident CTA, distinct from the
 *  quiet dashed pickers everywhere else. */
export function ScanMenuBanner() {
  return (
    <div style={{ width: 380 }}>
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
    </div>
  );
}

/** Disabled while an upload is already in flight. */
export function DisabledWhileBusy() {
  return (
    <div style={{ width: 360 }}>
      <PhotoPicker onPick={() => {}} disabled />
    </div>
  );
}
