// One-shot in-memory hand-off of picked File(s) from the Taste-AI-tab photo entry
// into the rating flow.
//
// The entry opens the OS photo picker itself (so tapping it goes STRAIGHT to the
// camera roll, skipping Dishi's own capture screen). The File(s) chosen there then
// have to survive a single client-side navigation into the flow. A module singleton
// does exactly that: it lives in the JS heap across route changes and is wiped on a
// full page refresh — the same rationale as scanSession.ts. Not Web Storage: a File
// isn't serializable, and there's nothing to persist beyond this one hop. take()
// clears on read, so a back-nav or refresh can never resurrect a stale photo.
//
// Array-shaped now (the album revamp lets you multi-select a whole roll into a
// flick stack). The single-photo helpers stay as thin wrappers so the classic
// /log?source=album path keeps working unchanged.
let pending: File[] = [];

export function setPendingPhotos(files: File[]): void {
  pending = files;
}

/** Returns the handed-off File(s) and clears them — single use by design. */
export function takePendingPhotos(): File[] {
  const f = pending;
  pending = [];
  return f;
}

export function setPendingPhoto(file: File): void {
  pending = [file];
}

/** Back-compat single-file take: the first handed-off file, clearing the rest. */
export function takePendingPhoto(): File | null {
  const f = pending;
  pending = [];
  return f[0] ?? null;
}
