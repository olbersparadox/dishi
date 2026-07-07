# Dishi — eat closer 食得近d

Photo-first taste engine. Photograph a dish, flick a rating, Dishi learns your palate
and recommends dishes loved by people whose taste statistically matches yours.

Full product spec, schema rationale, and objections: **SPEC.md**.

## Run it

1. `npm install`
2. Create a Supabase project → SQL editor → run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Enable Email (magic link) auth in Supabase Auth settings.
4. `cp .env.example .env.local` and fill in the Supabase URL + keys.
<<<<<<< HEAD
   `OPENROUTER_API_KEY` is optional — without it, vision + voice extraction use mocks
   and the loop still works end to end. Get a key at openrouter.ai; calls use
   `anthropic/claude-sonnet-5` (see src/lib/openrouter.ts for the model reasoning).
=======
   `ANTHROPIC_API_KEY` is optional — without it, vision + voice extraction use mocks
   and the loop still works end to end.
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
   `GOOGLE_PLACES_API_KEY` is also optional — without it, the restaurant quick-pick
   only searches Dishi's own restaurant list. To get one: Google Cloud Console →
   enable "Places API (New)" → create an API key → **set a daily quota cap** under
   APIs & Services → Quotas (a hard safety net against runaway billing).
5. `npm run dev` → http://localhost:3000
   (Use a phone or devtools device mode: geolocation, camera capture, and the flick
   gesture are built mobile-first. Geolocation requires HTTPS or localhost.)

## Map

- `src/lib/taste.ts` — the taste model: dimensions, EMA updates, similarity, blending. Read this first.
- `src/lib/mf.ts` — matrix-factorization engine (dormant until enough ratings exist) + the automatic blend-weight dial
- `src/lib/vision.ts` / `voice.ts` — LLM inference with offline mocks
- `src/lib/places.ts` / `placesCache.ts` — Google Places lookup with cost-conscious field masking and location-bucketed caching
- `src/lib/menuScan.ts` + `src/app/scan` — Menu Scanner: photograph a whole physical menu, every dish gets extracted and ranked against your taste vector with data-grounded reasons
- `src/lib/group.ts` + `src/app/table` — Table Mode: friends join with a code, dishes ranked by fairness math (0.6·min + 0.4·mean) so nobody at the table gets sacrificed
- `src/app/owner` + `src/app/api/restaurant/*` — Restaurant Dashboard: claim (unverified MVP) + analytics: dish performance, hidden gems, what diners love you for
- `src/lib/buddy.ts` + `src/components/Buddy*.tsx` — Taste Buddy: an animated companion that visualizes real engine confidence; XP weights variety over volume because that is the actual learning math
- `src/app/api/*` — dishes, ratings, recommendations, nearby restaurants (Dishi + Google merged), helpful points, mf/train
- `src/components/FlickRating.tsx` — the signature rating gesture (design rationale inline)
- `supabase/schema.sql` — tables + RLS + haversine quick-pick function

## Tests

`npm test` runs the suite in `tests/` (vitest): the taste engine's EMA/clamping/decay
behavior, the group-fairness guarantees (a dish everyone likes beats a dish one person
hates), the matrix-factorization engine (verified to actually learn latent structure on
synthetic data), and the activation dial's thresholds. The suite has already caught one
real bug: match-percent scaling that would have made every Table Mode ring read ~50.

## QR table ordering

Owners (dashboard → Tables & QR) add tables and print each table's QR. Diners scan →
`/order/<token>` → join the table's session → see the restaurant's live menu ranked
for their taste (group-fairness ranked when friends scan too) → order to a kitchen
queue (dashboard → Orders). No payments by design: staff confirm orders, payment
happens however the restaurant already takes it. Menus bootstrap in one photo
(dashboard → Menu → import) via the same scanner diners use.
<<<<<<< HEAD

## Languages

Traditional Chinese (HK flavour) is the default; toggle 中/EN in the header (persists
per device). Dish names render bilingually — primary language big and bold, the other
small and thin underneath, swapping with the mode. The vision pipeline now returns a
Traditional Chinese name for every dish it reads, so bilingual names exist even from
English-only menus. Known gap (next step): server-composed dynamic sentences — scan
reason lines, API error messages — are English-only for now; the owner dashboard
chrome likewise stays English this pass, though dish names in it are bilingual.
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
