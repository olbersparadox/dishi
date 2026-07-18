# Spec: photo EXIF → restaurant location (and eaten-date)

**Tier: [S] for Phase 1 (location), [F]-adjacent for Phase 2 (eaten-date/ordering).**

## Why

The nearby-restaurant picker only helps if you log **at** the restaurant — its
value is "you're here, tap the place." Logged later (couch, camera roll that
night), live GPS points at where you are *now*, which is the wrong location, so
the list becomes noise and cognitive load. This also mildly violates the
equal-weight-logging principle by privileging the restaurant path at the rating
moment.

A photo's EXIF answers the *right* question: **where/when the photo was taken**,
not where the phone is now. So a retrospective photo log can still surface the
correct restaurant — sourced from the photo, not from asking.

## Reachability (verified)

- `normalizePhoto` (image.ts) re-encodes through `<canvas>`, which **strips all
  EXIF** — but it runs only at *submit*, on a throwaway upload copy. The
  **original File is held in `photo` state** from pick time, untouched. So EXIF is
  read client-side from the original **before** normalize. Reachable.
- iPhone originals are **HEIC**; read EXIF from the file *bytes* (a byte-level
  reader handles HEIC without decoding the image).
- The two capture paths split usefully: **in-app camera** → no GPS, but you're
  present so **live GPS** covers it; **library pick** → original often has EXIF
  GPS+timestamp, and that's the retrospective case live GPS gets wrong.

## Phase 1 — location (build now)

1. **Read EXIF from the original File at pick time** (`onPickPhoto`), before
   `normalizePhoto`. Extract `{ lat, lng }` (GPS) and `takenAt` (DateTimeOriginal).
   Fail soft — missing/stripped EXIF returns nulls.
2. **Seed the nearby picker with the photo coords.** `/api/restaurants/nearby?lat
   &lng` already merges Dishi's own restaurants + Google Places Nearby around any
   lat/lng — today it's fed live GPS. `RestaurantPicker` gains an optional
   `seedCoords` prop; source priority:
   - photo EXIF coords (library pick) → nearby around the photo spot
   - else live GPS (in-app camera / present)
   - else skip / manual (typed, or stripped photo)
3. **Show the shortlist, don't auto-pick.** Photo GPS is building-level (~5–50m
   drift), so a single auto-guess risks the venue next door. The 300m nearby list
   contains the real place, sorted by distance from the shot — user taps once.
   Distances now read "45m from where this photo was taken." `createNew`/reverse-
   geocode inherit the photo coords, so a manually-added place lands at the right
   spot too.
4. **Quiet indicator** when the list is seeded from a photo (e.g. "📍 around where
   this photo was taken"), so it's transparent, not magic.

Cost/privacy envelope unchanged: same cached (~111m), field-masked Places call the
app already makes; coords go server-side exactly as live GPS does today.

## Phase 2 — eaten-date (deferred, needs the 食記 ordering decision)

`takenAt` (EXIF timestamp, survives stripping better than GPS) is the **eaten-date**
— the open 食記 album-ordering question ("when-eaten vs when-logged, no friction").
Needs: a `dishes.eaten_at` column (migration), wiring it through dish creation, and
deciding journal order (eaten vs logged). Hold until that design conversation.
Phase 1 already *reads* `takenAt`, so Phase 2 is mostly plumbing + the design call.

## Fallback ladder (never a hard dependency)

Photo has GPS → seed nearby. No GPS (stripped share-sheet/screenshot/location-off,
or in-app camera) → live GPS. No location at all → today's skip/manual picker.
Strict improvement, no regressions.

## Tests / acceptance

- EXIF reader: returns coords+date for a GPS'd original; nulls for a stripped/
  screenshot file; handles HEIC. (Unit-test the pure parse where feasible; real
  hit-rate is a device check on real camera-roll photos.)
- RestaurantPicker: with `seedCoords`, fetches nearby for those coords and skips
  geolocation; without it, behaves exactly as today.
- tsc + npm test green. Manual: pick a GPS'd photo → nearby list is around the
  photo spot, not the couch.
