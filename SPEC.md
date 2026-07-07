# Dishi — MVP Specification

## 1. Product spec

Dishi is a photo-first taste engine: you photograph what you're eating, flick a one-second rating, and it builds a quantified profile of your palate — flavor axes, textures, richness, cooking methods, cuisines — then recommends dishes loved by people whose profiles statistically match yours, rather than whatever is trending. It is for food-curious urban eaters who take photos of their meals anyway and are tired of recommendation feeds that reflect the median diner instead of them. The structural bet that distinguishes it from 2014-era social food apps: the core loop delivers value to a single user from the first rating (your own profile visibly sharpens), so the product does not depend on your friends joining before it is useful — the network layer is an upgrade, not a prerequisite.

## 2. User flows

### Onboarding (seeding a taste vector before any ratings)

1. Magic-link sign-in (email only, no password).
2. Optional 30-second "palate primer": the seed feed shows ~12 well-known dishes (from the synthetic dataset) and invites the user to flick-rate any they know. Each flick is a real rating against a hand-set attribute vector, so three flicks already produce a usable profile. This reframes cold start as onboarding: rating famous dishes from memory is the fastest possible way to seed the vector, and it teaches the gesture.
3. Skip is allowed; the vector then starts at zero and the feed shows seed dishes labeled honestly ("Rate a few dishes and this feed becomes yours").

### Core loop: photo → rate → learn → recommend

1. **Photo** — camera or gallery, one tap.
2. **Where** — GPS quick-pick of the nearest known restaurants as chips (≤8, nearest first, distance shown); "+ Add a place" pins a new restaurant entity at current coordinates; "Not at a restaurant" makes home cooking first-class.
3. **Vision read** — server identifies the dish + 18-dim attribute vector + confidence. The user sees the guessed name with a one-tap "Fix the name" escape hatch; low confidence is flagged, never hidden.
4. **Flick rating** — vertical drag on the photo, direction = valence, distance = intensity, live word feedback ("Inhaled it" → "Never again"), photo saturates or drains with the drag, 2.5s undo. Under two seconds, no typing. Accessible tap-chip fallback.
5. **Voice note (optional)** — on-device Web Speech transcription; server LLM extracts structured attributes ("too salty but loved the char" → `{salty: 0.9, grilled: 0.8}`) plus an optional sentiment hint that nudges the score. Never stored as an unstructured blob only.
6. **Learn** — taste vector updates via decaying-rate EMA in the same request; the profile page shows exactly what was learned as signed bars per dimension.
7. **Recommend** — the For You feed blends content-based and collaborative scores (see §Cold start) with an honest reason label per card and a "This helped me decide" mark that pays the original logger points.

### Cold-start strategy (explicit)

Three continuous stages, no hard switches, no empty states:

| Stage | Condition | Feed | Label |
|---|---|---|---|
| Seed | 0 ratings | Synthetic dataset of 20 common dishes with hand-set plausible vectors (`seed.sql`) | "Popular on Dishi" |
| Content | ≥1 rating, little cross-user data | Dishes whose attribute vectors align with the user's taste vector (dot product + cuisine affinity) | "Similar to dishes you loved" |
| Collaborative | Similar users (cosine > 0.2, ≥3 ratings each) have rated candidates | Similarity-weighted average of neighbors' ratings, blended with content score; blend weight = min(1, signals/10) | "People with your taste loved this" |

For the first 100 users this means: the app is honest that it's content-based, the seed dishes double as the onboarding primer, and every real rating both improves the individual's feed *and* accumulates the cross-user matrix that eventually flips the labels to collaborative. Synthetic rows award no points and are deleted once real logs dominate.

## 3. Database schema

See `supabase/schema.sql` for full DDL with RLS policies. Summary:

- **profiles** — id (→ auth.users), handle, points (denormalized total).
- **restaurants** — id, name, lat, lng, address, created_by. Own entity so ratings aggregate per restaurant; `nearby_restaurants()` SQL function does haversine quick-pick.
- **dishes** — one row per logged dish instance: user_id (null only for synthetic), restaurant_id, name, cuisine, photo_url, `attributes jsonb` (18 dims, 0–1), vision_confidence, is_synthetic.
- **ratings** — user_id + dish_id (unique), score (−1..1), voice_transcript, `voice_attributes jsonb`.
- **taste_profiles** — user_id, `vector jsonb` (18 dims, −1..1), `cuisine_affinity jsonb`, rating_count.
- **helpful_marks** — dish_id + marked_by (unique = one mark per person per dish).
- **points_ledger** — append-only award log; profiles.points is the running total.

Vectors are jsonb keyed by name (not arrays) so dimensions can evolve without migrations during MVP. Recommendations are computed at read time, not stored — at MVP scale a materialized recommendations table is premature.

## 4. API map

| Route | Method | Does |
|---|---|---|
| `/api/restaurants/nearby?lat&lng` | GET | Haversine quick-pick, ≤8 within ~300m |
| `/api/dishes` | POST (multipart) | Upload photo → storage, run vision inference, create restaurant if new, return dish + confidence |
| `/api/ratings` | POST | Upsert rating, extract voice signal via LLM, update taste vector + cuisine affinity in-request |
| `/api/recommendations` | GET | Staged content/collab blend, reason labels, excludes own/rated dishes |
| `/api/helpful` | POST | "This helped me decide" mark → diminishing-returns points (10, 8, 6, 5, 4, 3, then 2/dish) to the log owner |

Auth (magic link) and profile reads go direct to Supabase from the client under RLS.

## 5. Working code — key decisions and why

- **Vision**: Claude vision (sonnet) prompted to return strict JSON: dish name, cuisine, 18 attribute intensities, confidence. Chosen over a dedicated food-classifier because a general vision LLM handles the long tail (home cooking, fusion, half-eaten plates) and outputs the attribute vector directly — no separate dish-name→attributes lookup table to build. Confidence is surfaced to the user and stored, so later reweighting is possible. A deterministic mock keeps the whole loop demoable with no API key.
- **Taste representation**: fixed interpretable 18-dim space (6 flavor, 4 texture, 2 body, 6 method) + a cuisine-affinity map, not a learned embedding. At <10k ratings a latent space is noise; interpretable dims mean the vision model can emit them, voice notes map onto them, and a bad recommendation can be debugged by reading the vector. Update rule: EMA with learning rate max(0.08, 1/(n+2)) — early ratings move the profile fast (cold start), later ones refine. User similarity: cosine. All in `src/lib/taste.ts` with reasoning inline.
- **Voice**: Web Speech API on-device (free, no upload, no latency) → transcript → LLM extraction into attribute presences + sentiment hint. User words override photo guesses in the profile update, because "too salty" from the eater beats "salty 0.5" from a photo.
- **Points**: diminishing schedule per dish so one viral log can't dominate; no self-marks; one mark per user per dish; synthetic dishes pay nothing.

## 6. First sprint checklist

**Built and functional**
- Magic-link auth, profile bootstrap
- Photo upload → Supabase storage → vision inference (real with key, mocked without)
- Restaurant entity + GPS haversine quick-pick + inline add + skip
- Flick rating with intensity, live feedback, undo, accessible fallback
- Voice note → transcription → structured extraction → score nudge
- Taste vector EMA updates + cuisine affinity, visible on profile
- Staged recommendations (seed → content → collaborative) with honest labels
- Helpful marks + diminishing points + ledger
- Synthetic seed dataset (20 dishes)

**Stubbed / mocked for demo**
- Vision + voice extraction fall back to mocks without `ANTHROPIC_API_KEY`
- Restaurant search covers only Dishi's own table (no Places API backfill)
- Web Speech API coverage varies by browser; text field is the universal fallback
- No image resizing/EXIF handling before upload

**Next**
- Palate-primer onboarding screen (seed dishes exist; the dedicated first-run UI doesn't)
- Places API backfill for the quick-pick in cold cities
- Restaurant pages aggregating dishes/ratings (schema supports it)
- Rate-limiting + abuse checks on helpful marks (e.g. only markable from a served recommendation)
- Context features (meal time, solo/group) as vector conditioning
- Batch job re-running vision on low-confidence dishes as models improve

## 7. Three strongest objections, steelmanned

**1. Photo-based attribute inference is unreliable, and errors poison the profile.**
Restaurant lighting is bad, sauces hide ingredients, a curry photographs like ten other curries, and spiciness is nearly invisible. If the vector for the dish is wrong, the rating teaches the profile the wrong lesson — silently.
*Mitigation:* confidence is a first-class value: stored per dish, shown to the user, and the natural next step is confidence-weighted learning rates (low-confidence dishes move the profile less — one line in `updateTaste`). The name-confirm chip catches gross misidentification at the moment the user cares. Voice notes are the correction channel that beats any vision model — the eater saying "so spicy" overrides the photo. And errors are unbiased at the profile level: a taste vector is an average over dozens of dishes, so uncorrelated attribute noise washes out; only systematic bias (e.g. always underestimating spice) persists, and that is fixable centrally. The honest concession: individual dish recommendations inherit individual dish errors, which is why reason labels avoid overclaiming.

**2. Users won't rate consistently — the log-and-forget graveyard.**
Every food app discovers that photographing is fun once and a chore by week two. If rating density is low, the profile stalls and the promise ("Dishi knows your taste") quietly fails, which is worse than never promising.
*Mitigation:* this is precisely the pain-vs-behavior test: the person asked to change behavior (rate dishes) must be the person who feels the benefit. Here they are the same person — every flick visibly updates *your own* profile page, and the interaction cost is genuinely sub-2-seconds with no typing. The seed-primer means even three ratings produce a feed that feels different. What the design deliberately avoids: streaks, guilt mechanics, or making the social layer load-bearing. Residual risk is real, and the metric to watch in week one is ratings-per-user-per-week, not signups.

**3. Taste is too context-dependent to vectorize — the same person loves tonkotsu on a cold night and finds it repulsive at lunch.**
Hunger, weather, company, occasion, and mood all modulate preference; a static vector averages across contexts and may converge to a bland centroid that predicts nobody's next craving.
*Mitigation:* partly conceded — the MVP treats each rating as a noisy sample of a stable underlying palate, and the EMA is exactly the right tool for noisy samples. But the deeper answer is that the vector doesn't need to predict *what you want right now*; it needs to rank *which unfamiliar dishes are worth trying*, a much weaker and more stable claim, and the UI language ("worth trying", "people with your taste loved") is written to that claim. Context conditioning (time-of-day, restaurant type — already captured as data) is the roadmap answer: same vector, contextual reweighting. If preferences turn out to be mostly context and barely person, the product thesis fails — that's the falsifiable bet, and rating→return-visit correlation is the test.
