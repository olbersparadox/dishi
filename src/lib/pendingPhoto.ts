// One-shot in-memory hand-off of a picked File from the Taste-tab "+相簿舊菜"
// entry into the /log album flow.
//
// The album button opens the OS photo picker itself (so tapping it goes STRAIGHT
// to the camera roll, skipping Dishi's own capture screen). The File chosen there
// then has to survive a single client-side navigation to /log?source=album. A
// module singleton does exactly that: it lives in the JS heap across route changes
// and is wiped on a full page refresh — the same rationale as scanSession.ts. Not
// Web Storage: a File isn't serializable, and there's nothing to persist beyond
// this one hop. take() clears on read, so a back-nav or refresh can never
// resurrect a stale photo.
let pending: File | null = null;

export function setPendingPhoto(file: File): void {
  pending = file;
}

/** Returns the handed-off File (if any) and clears it — single use by design. */
export function takePendingPhoto(): File | null {
  const f = pending;
  pending = null;
  return f;
}
