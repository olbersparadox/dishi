'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import { supabaseBrowser } from '@/lib/supabase/client';
import TasteFormCard from '@/components/TasteFormCard';
import SealReveal, { type SealResult } from '@/components/SealReveal';
import DishName from '@/components/DishName';
import SealStamp from '@/components/SealStamp';
import ExplainModal from '@/components/ExplainModal';
import type { ExportDish } from '@/lib/tasteExport';
import { isPersona, type Persona } from '@/lib/persona';
import { RateIcon, TrashIcon, UtensilsIcon, HomeIcon, PhotoIcon } from '@/components/icons';
import PickCardThumb from '@/components/PickCardThumb';
import { normalizePhoto } from '@/lib/image';
import RatingStack, { type ExistingPick } from '@/components/RatingStack';
import { clearJournalCache } from '@/lib/journalCache';
import { wordKeyFor } from '@/lib/flickWords';
import { useLang } from '@/lib/i18n';

export default function ProfilePage() {
  return (
    <AuthGate>
      <TasteProfile />
    </AuthGate>
  );
}

type ToRate = {
  id: string; name: string; name_zh: string | null; cuisine: string | null;
  source: string; restaurant: string | null;
  // Carried so a queued pick can be rated through the flick → growth flow: the photo
  // for its card (menu picks usually have none), the coords to seed nearby places,
  // and the restaurant it was picked AT — known context that must ride to the
  // growth card as fixed display instead of being re-guessed (pickContext.ts).
  photo_url: string | null; lat: number | null; lng: number | null;
  restaurant_id: string | null; restaurant_name_zh: string | null;
};

/** Rated rows as the API returns them — kept whole (ids + identity links)
 * so the 已評嘅菜 list can group same-real-dish occasions instead of showing
 * a linked pair (蝦餃 / 水晶鮮蝦餃) as two unrelated rows. ExportDish for the
 * AI prompt is DERIVED from these, not fetched separately. */
type RatedRow = {
  id: string; name: string; name_zh: string | null; restaurant: string | null;
  my_score: number | null; created_at: string;
  eaten_at: string | null; source: string | null;
  dish_identity_id: string | null;
  identity_name: string | null; identity_name_zh: string | null;
  /** Shared-table dish (has 同檯 companion edges) — feeds the export's honest
   * "loved dishes skew communal" line. */
  shared: boolean;
};

function TasteProfile() {
  const { t } = useLang();
  const router = useRouter();
  // Album picks open the rating flow as an in-page OVERLAY (this page stays mounted
  // behind the glass) rather than navigating away — so the drag-and-rate screen sits
  // on top of the live Taste AI section.
  const [ratePhotos, setRatePhotos] = useState<File[] | null>(null);
  const [ratePick, setRatePick] = useState<ExistingPick | null>(null); // a queued 待評 pick
  const [logHelp, setLogHelp] = useState(false); // tap the ⓘ on the entry card → how/why to rate
  // Bumped when the rating overlay closes so THIS page's client-fetched data (taste
  // vector, rated list, to-rate) reloads without a hard refresh. Also drives a key on
  // the buddy card so it re-fetches /api/buddy. router.refresh() (on close) covers the
  // other tabs (the 食記 journal) by invalidating the App Router cache.
  const [refreshKey, setRefreshKey] = useState(0);
  // The album rating flow just created + rated dishes, but it lives on THIS tab (not
  // /log), so the 食記 journal's in-memory cache never saw them — clear it so the next
  // visit refetches and shows the new dishes (was: stale until a full reload).
  // Shared exit for BOTH rating entry points (album batch and a queued pick): drop the
  // journal cache, remount the taste card, and refetch — a just-rated pick has to leave
  // the 待評 queue, and the engine reading behind the card has moved.
  const closeRating = () => {
    clearJournalCache(); setRatePhotos(null); setRatePick(null);
    setRefreshKey(k => k + 1); router.refresh();
  };
  const [vector, setVector] = useState<Record<string, number>>({});
  const [affinity, setAffinity] = useState<Record<string, number>>({});
  const [count, setCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [toRate, setToRate] = useState<ToRate[] | null>(null);
  const [ratedRows, setRatedRows] = useState<RatedRow[]>([]);
  const [justRated, setJustRated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sealReveal, setSealReveal] = useState<SealResult | null>(null);
  const [justLearned, setJustLearned] = useState<{ dim: string; dir: number }[] | null>(null);
  const [sealedIds, setSealedIds] = useState<Set<string>>(new Set());
  const [persona, setPersona] = useState<Persona>('spoon');
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    // The rating flow lands here (not Home) the moment a rating is saved — this
    // is where "what did that just teach Dishi" and "rate another?" belong,
    // since Taste is the screen about training the engine, not browsing it.
    if (new URLSearchParams(window.location.search).get('rated') === '1') {
      setJustRated(true);
      window.history.replaceState({}, '', '/profile'); // don't re-celebrate on refresh
      try {
        const rawSeal = sessionStorage.getItem('dishi_seal_reveal');
        if (rawSeal) { setSealReveal(JSON.parse(rawSeal)); sessionStorage.removeItem('dishi_seal_reveal'); }
        const rawLearned = sessionStorage.getItem('dishi_just_learned');
        if (rawLearned) { setJustLearned(JSON.parse(rawLearned)); sessionStorage.removeItem('dishi_just_learned'); }
      } catch { /* storage may be unavailable */ }
    }
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      const [{ data: taste }, { data: prof }] = await Promise.all([
        supabase.from('taste_profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('profiles').select('points, handle').eq('id', uid).maybeSingle(),
      ]);
      if (taste) {
        setVector(taste.vector ?? {});
        setAffinity(taste.cuisine_affinity ?? {});
        setCount(taste.rating_count ?? 0);
        if (isPersona(taste.persona)) setPersona(taste.persona);
      }
      setPoints(prof?.points ?? 0);
      setHandle(prof?.handle ?? null);
    });
    fetch('/api/my/dishes?unrated=1').then(r => r.json()).then(async j => {
      const dishes = j.dishes ?? [];
      setToRate(dishes);
      // Lazily seal each to-rate dish. Idempotent + server-gated (only seals if
      // the engine has >= SEAL_GATE ratings), so this is safe to call every
      // time the list loads — it either creates the seal once or no-ops.
      const sealed = new Set<string>();
      await Promise.all(dishes.map(async (d: ToRate) => {
        try {
          const res = await fetch('/api/seals', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dish_id: d.id }),
          });
          const out = await res.json().catch(() => ({}));
          if (out.sealed) sealed.add(d.id);
        } catch { /* non-critical — the card just won't show a stamp */ }
      }));
      setSealedIds(sealed);
    }).catch(() => setToRate([]));
    // Concrete rated dishes: kept as full rows (id + identity link) so the
    // 已評嘅菜 list can group same-real-dish occasions; the AI-export evidence
    // shape is derived from the same fetch rather than fetched twice.
    fetch('/api/my/dishes?rated=1')
      .then(r => r.json())
      .then(j => setRatedRows((j.dishes ?? [])
        .filter((d: any) => d.my_score !== null)
        .map((d: any) => ({
          id: d.id, name: d.name, name_zh: d.name_zh, restaurant: d.restaurant,
          my_score: d.my_score, created_at: d.created_at,
          eaten_at: d.eaten_at ?? null, source: d.source ?? null,
          dish_identity_id: d.dish_identity_id ?? null,
          identity_name: d.identity_name ?? null, identity_name_zh: d.identity_name_zh ?? null,
          shared: (d.companions?.length ?? 0) > 0,
        }))))
      .catch(() => setRatedRows([]));
  }, [refreshKey]);

  const exportDishes: ExportDish[] = ratedRows.map(d => ({
    name: d.name, name_zh: d.name_zh, score: d.my_score as number, restaurant: d.restaurant,
    eaten_at: d.eaten_at, source: d.source, shared: d.shared,
  }));

  // 已評嘅菜, grouped by real-world identity: linked occasions (same
  // dish_identity_id) collapse into ONE row — labelled with the identity's
  // canonical name, carrying the most recent occasion's verdict. Unlinked
  // dishes group by their own row id (i.e. stay as-is). Rows arrive newest
  // first from the API, so first-seen per group IS the latest occasion.
  const ratedGroups = (() => {
    const seen = new Map<string, RatedRow>();
    for (const d of ratedRows) {
      const key = d.dish_identity_id ? `id:${d.dish_identity_id}` : `row:${d.id}`;
      if (!seen.has(key)) seen.set(key, d);
    }
    return Array.from(seen.values());
  })();

  /** Drop a pick you don't actually want to rate. Same DELETE the rated list uses;
   * an unrated pick is never locked (nobody else has rated it), so this can't be
   * blocked. Optimistic, reverting if the server refuses. */
  async function removePick(id: string) {
    if (!confirm(t('home.delete.confirm'))) return;
    const prev = toRate;
    setToRate(cur => cur?.filter(d => d.id !== id) ?? null);
    const res = await fetch('/api/my/dishes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: id }),
    });
    if (!res.ok) setToRate(prev);
  }

  // Attach a photo to a 待評 pick that has none (a scan/table pick — the normal
  // case) — the SAME endpoint + path MyDishes' 食記 edit uses for the identical
  // gap, reused rather than reinvented. Which pick is uploading tracks separately
  // so its badge can show a "saving" state instead of silently doing nothing.
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  async function addPickPhoto(dishId: string, file: File | null) {
    if (!file) return;
    setPhotoUploadingId(dishId);
    try {
      const form = new FormData();
      form.append('dish_id', dishId);
      form.append('photo', await normalizePhoto(file, 1024));
      const res = await fetch('/api/dishes/photo', { method: 'POST', body: form });
      const json = await res.json();
      if (res.ok) {
        setToRate(cur => cur?.map(d => d.id === dishId ? { ...d, photo_url: json.dish.photo_url } : d) ?? null);
      }
    } catch { /* leave the placeholder; a failed upload just means "still no photo" */ }
    finally { setPhotoUploadingId(null); }
  }

  return (
    <div>
      {justRated && sealReveal && <SealReveal seal={sealReveal} />}
      {justRated && (
        <div className="rated-banner" role="status">
          <span className="rated-banner-icon" aria-hidden>🍜</span>
          <span className="rated-banner-text">
            {justLearned && justLearned.length > 0
              ? t('profile.justlearned', {
                  dims: justLearned.map(x => `${t(`dim.${x.dim}`)} ${x.dir > 0 ? '↑' : '↓'}`).join(' · '),
                })
              : t('home.rated')}
          </span>
        </div>
      )}
      <h1 style={{ marginBottom: 22 }}>{t('profile.title')}</h1>

      {/* +Log is no longer its own bottom-nav tab (nav is now Feed / Scan /
          Taste) — this is the bridge so photographing and rating a dish directly
          (not via a menu-scan pick) is still one tap away, right where Jerry
          asked for "rate a dish" to live. */}
      {/* ONE merged entry pill, three segments split by a thin hairline. All three do
          the EXACT SAME thing — open the photo library (multi-select) and hand the roll
          to the flick rating flow. The three labels are purely a TEACHING surface: they
          tell the person everything counts — a restaurant dish, tonight's home cooking,
          or an old camera-roll shot — but there's no behavioural difference. EXIF (when
          present) supplies where + when for all of them; home vs restaurant vs skip is
          chosen per-dish inside the flow. Each segment is a <label> so the tap natively
          opens the picker with a real user gesture.
          (2026-07-22: the 食物相/打字/外賣單 redesign was rolled back — the 打字 typed
          quick-add flow hung on enrich and felt inconsistent with the rest of the app.
          TypedQuickAdd.tsx, the /api/dishes/suggest predictive endpoint, and RatingStack's
          typed mode are kept in the codebase, unmounted, for a later retry — see
          docs/BACKLOG.md.) */}
      <div className="log-src-merged">
        {/* ⓘ — how/why to rate. Sits above the three <label> segments (own onClick,
            stopPropagation) so tapping it opens the explainer, not the photo picker. */}
        <button type="button" className="card-info-badge" aria-label={t('logsrc.help.title')}
          onClick={e => { e.stopPropagation(); setLogHelp(true); }}>i</button>
        {([
          { id: 'rest', icon: <UtensilsIcon size={42} />, key: 'logsrc.rest' },
          { id: 'home', icon: <HomeIcon size={42} />, key: 'logsrc.home' },
          { id: 'album', icon: <PhotoIcon size={42} />, key: 'logsrc.album' },
        ] as const).map(seg => (
          <label key={seg.id} className="log-src-seg">
            {seg.icon}<span>+{t(seg.key)}</span>
            <input type="file" accept="image/*" multiple hidden onChange={e => {
              const fs = Array.from(e.target.files ?? []);
              e.target.value = ''; // allow re-picking the same files next time
              if (fs.length) setRatePhotos(fs); // open the rating overlay in place
            }} />
          </label>
        ))}
      </div>
      {logHelp && (
        <ExplainModal title={t('logsrc.help.title')} body={t('logsrc.help.body')} onClose={() => setLogHelp(false)} />
      )}

      {/* Rating flow as a full-screen overlay ON TOP of this Taste AI page (kept
          mounted behind, so the drag-and-rate glass blurs the live section). */}
      {ratePhotos && userId && <RatingStack photos={ratePhotos} userId={userId} onExit={closeRating} />}
      {ratePick && userId && <RatingStack picks={[ratePick]} userId={userId} onExit={closeRating} />}

      {/* Dishes waiting to be rated — picked off a menu scan or during a shared
          table, not yet rated. Living here (not buried on /log) is deliberate:
          Jerry's framing is "menu scan is the focus; rating is what trains
          Dishi to get more relevant" — so the training queue belongs on the
          Taste tab, where the training itself is the point of being here. */}
      {toRate !== null && toRate.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 2 }}>{t('log.toRate')}</h3>
          {toRate.map(p => (
            <div key={p.id} className="pick-card">
              <PickCardThumb photoUrl={p.photo_url} uploading={photoUploadingId === p.id}
                onPick={file => addPickPhoto(p.id, file)} />
              <div style={{ minWidth: 0 }}>
                <div className="pick-card-name">
                <DishName id={p.id} name={p.name} name_zh={p.name_zh}
                  suffix={sealedIds.has(p.id) && <SealStamp />} />
              </div>
                <div className="pick-card-meta">{p.restaurant ?? t('home.homecooking')}</div>
              </div>
              {/* Rate AND delete. A pick you no longer want was previously stuck in
                  this queue forever with no way out but rating it — which would have
                  taught the engine from a dish you never actually ate. */}
              <div className="pick-card-actions">
                {/* Same flick → growth flow as an album batch (it used to bounce out to
                    the old single-dish /log page). Nothing is created here, so the
                    session can never delete this pick — see RatingStack.picksMode. */}
                <button className="icon-btn lg rate" onClick={() => setRatePick({
                  dishId: p.id, photoUrl: p.photo_url ?? null,
                  name: p.name, name_zh: p.name_zh,
                  coords: p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
                  restaurant: p.restaurant_id
                    ? { id: p.restaurant_id, name: p.restaurant ?? '', name_zh: p.restaurant_name_zh }
                    : null,
                })}
                  aria-label={t('log.rateNow')} title={t('log.rateNow')}>
                  <RateIcon size={20} />
                </button>
                <button className="icon-btn lg delete" onClick={() => removePick(p.id)}
                  aria-label={t('home.delete')} title={t('home.delete')}>
                  <TrashIcon size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {userId && <TasteFormCard key={refreshKey} vector={vector} affinity={affinity} count={count} dishes={exportDishes} userId={userId}
        persona={persona} name={handle} />}

      {/* 已評嘅菜 — flat, no-photo reference list below the AI export card per the
          design. Identity-grouped: a dish rated twice under linked names shows
          once, under its canonical identity name. The richer per-occasion photo
          journal lives on the Feed tab. */}
      {ratedGroups.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 2 }}>{t('profile.rated')}</h3>
          {ratedGroups.map(d => (
            <div className="rated-flat-row" key={d.dish_identity_id ?? d.id}>
              <div style={{ minWidth: 0 }}>
                <div className="card-title">
                  <DishName id={d.id} name={d.identity_name ?? d.name} name_zh={d.identity_name_zh ?? d.name_zh} />
                </div>
                {d.restaurant && <div className="rated-flat-meta">{d.restaurant}</div>}
              </div>
              <div className="rated-flat-verdict">{t(wordKeyFor(d.my_score as number))}</div>
            </div>
          ))}
        </div>
      )}

      {/* The standalone 菜系 card that used to live here moved INTO the 味 AI card's
          own 菜系 stat explainer (tap the number) — same pills, shown where the
          number is actually explained instead of duplicated further down the page. */}

      {/* Restaurant-owner front door. The "claim your page" entry Dishi's
          owner-side monetisation hangs off — it needs to be genuinely findable by
          an owner who's looking, not a grey afterthought, while staying quiet
          enough that it isn't noise for the diners who are 99% of users. A single
          bordered, tappable row does both. */}
      <a href="/owner" className="owner-entry">
        <div>
          <div className="owner-entry-title">{t('profile.owner')}</div>
          <div className="owner-entry-blurb">{t('profile.owner.blurb')}</div>
        </div>
        <span className="owner-entry-cta" aria-hidden>{t('profile.owner.link')} →</span>
      </a>
    </div>
  );
}
