'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import DishName from '@/components/DishName';
import RestaurantPicker, { RestaurantChoice } from '@/components/RestaurantPicker';
import FlickRating from '@/components/FlickRating';
import { cuisineLabel, localeOf, type LangCode } from '@/lib/i18n';
import { wordKeyFor } from '@/lib/flickWords';
import { EditIcon, TrashIcon, MoreIcon } from './icons';
import { cookingBucket, type CookingMethod } from '@/lib/menuScan';
import DishInfoDisplay from './DishInfoDisplay';
import { normalizePhoto } from '@/lib/image';
import { getJournalCache, setJournalCache } from '@/lib/journalCache';

export type MyDish = {
  id: string; name: string; name_zh: string | null; cuisine: string | null;
  photo_url: string | null; restaurant: string | null; hearts: number; my_score: number | null;
  locked: boolean; created_at: string; eaten_at?: string | null;
  restaurant_area?: string | null; source?: string | null;
  district?: DistrictMap | null; restaurant_district?: DistrictMap | null;
  restaurant_id?: string | null; dish_identity_id?: string | null;
  dish_identity_checked_at?: string | null;
  identity_name?: string | null; identity_name_zh?: string | null;
  cooking_method?: string | null; heaviness?: string | null; diet?: string[] | null;
};

/** Rated-on label for a journal row: date + weekday (7月11日 星期六 / Sat, Jul 11). */
function formatRatedDate(iso: string, lang: 'zh' | 'en'): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  if (lang === 'zh') {
    const weekday = d.toLocaleDateString('zh-HK', { weekday: 'long' }); // 星期六
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`;
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); // Sat, Jul 11
}

/** When-eaten label (no weekday, to read as a diary date not a log timestamp):
 * 2026年7月12日 / Jul 12, 2026 / 2026年7月12日(ja) / 2026. 7. 12.(ko) … It follows the
 * PRIMARY dish-name language, not the zh/en chrome — the date is data the browser can
 * localize itself. zh/en keep their exact existing formats; any other primary formats
 * through its own Intl locale (no authored copy). */
function formatEatenDate(iso: string, code: LangCode): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  if (code === 'zh') return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  if (code === 'en') return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return d.toLocaleDateString(localeOf(code), { year: 'numeric', month: 'short', day: 'numeric' });
}

/** A district in the viewer's language, English-falling-back (works for any country:
 * a place with no zh name stored zh=en, so zh viewers see English). */
type DistrictMap = { zh?: string | null; en?: string | null };
function pickDistrict(m: DistrictMap | null | undefined, lang: 'zh' | 'en'): string | null {
  if (!m) return null;
  return m[lang] || m.en || m.zh || null;
}

/** The location line: always shows WHERE the food is. Restaurant -> "name • district"
 * (the restaurant's own area, bilingual). No restaurant -> the log district; home
 * cooking keeps its marker ("住家菜 • 葵芳"); a bare 住家菜 only when nothing's known. */
function locationLabel(d: MyDish, homeLabel: string, lang: 'zh' | 'en'): string {
  if (d.restaurant) {
    const area = pickDistrict(d.restaurant_district, lang) ?? d.restaurant_area ?? null; // legacy text fallback
    return d.restaurant + (area ? ` • ${area}` : '');
  }
  const dist = pickDistrict(d.district, lang);
  if (d.source === 'home') return homeLabel + (dist ? ` • ${dist}` : '');
  return dist || homeLabel; // skipped picker: the district, or 住家菜 as a last resort
}

/** ISO instant -> yyyy-mm-dd for a native <input type="date"> value (local date). */
function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Placeholder rows while the journal loads — pulsing photo + text stand-ins in the
 * real row layout, so the page has shape immediately instead of a blank flash. */
function JournalSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3, 4].map(i => (
        <article className="rated-dish-row" key={`skel-${i}`}>
          <div className="card-body journal-row">
            <div className="journal-photo skel-box" />
            <div className="journal-skel-lines">
              <span className="skel-box" style={{ width: '38%', height: 15, borderRadius: 6 }} />
              <span className="skel-box" style={{ width: '66%', height: 12, borderRadius: 6 }} />
              <span className="skel-box" style={{ width: '28%', height: 12, borderRadius: 6 }} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * The user's own rated dishes: photo, hearts received, rename, restaurant change,
 * re-rate, delete. Lives on the Feed tab (食記 food journal — see page.tsx) —
 * the strategic reversal that moved the rated list off Taste and replaced the
 * old recommendation feed with it. Taste stays focused on the taste-form,
 * stats, and export; this is "what have I actually eaten."
 *
 * Edit covers all three things a person might actually need to fix about a
 * logged dish, not just its name: the name, which restaurant it's at, and the
 * rating itself (re-flicking calls the same POST /api/ratings a fresh rating
 * does — it's a clean upsert, so "editing" a rating and "re-rating" a dish are
 * the same real action, not two different code paths pretending to be one).
 */
export default function MyDishes({ t, lang, infoLang }: { t: (k: string, p?: Record<string, string | number>) => string; lang: 'zh' | 'en'; infoLang: LangCode }) {
  // Restore the list from the module cache on mount (lazy initializers, so this reads
  // the snapshot once). A tab switch away and back lands here with the rows already in
  // state — no skeleton, no refetch. First-ever load (no cache) starts null → skeleton.
  const [dishes, setDishes] = useState<MyDish[] | null>(() => getJournalCache()?.dishes ?? null);
  const [editing, setEditing] = useState<string | null>(null);
  // Which row's "more actions" (edit/delete) menu is currently open — a single
  // kebab button replaces the previous always-visible edit+delete icon pair,
  // per the decided design; at most one row's menu is open at a time.
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // Which photoless row is currently uploading a just-picked photo — so its
  // placeholder can show a "saving" state instead of silently doing nothing.
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);

  /** Attach a photo to a rated dish that never had one (a pick rated off a menu).
   * Same endpoint /log uses; updates the row in place on success. */
  async function addPhoto(dishId: string, file: File | null) {
    if (!file) return;
    setPhotoUploadingId(dishId);
    try {
      const form = new FormData();
      form.append('dish_id', dishId);
      form.append('photo', await normalizePhoto(file, 1024));
      const res = await fetch('/api/dishes/photo', { method: 'POST', body: form });
      const json = await res.json();
      if (res.ok) {
        setDishes(prev => prev?.map(d => d.id === dishId ? { ...d, photo_url: json.dish.photo_url } : d) ?? null);
      }
    } catch { /* leave the placeholder; a failed upload just means "still no photo" */ }
    finally { setPhotoUploadingId(null); }
  }
  const [draftName, setDraftName] = useState('');
  const [draftNameZh, setDraftNameZh] = useState('');
  const [editedEn, setEditedEn] = useState(false);
  const [editedZh, setEditedZh] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [relearnedId, setRelearnedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(() => getJournalCache()?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Within an open edit card: which secondary editor (if any) is expanded.
  // Collapsed by default — showing a full restaurant picker or flick-photo
  // surface inline on every single dish card would be a lot of always-on UI
  // for something most edits never touch.
  const [changingRestaurant, setChangingRestaurant] = useState(false);
  const [draftRestaurant, setDraftRestaurant] = useState<RestaurantChoice>(null);
  const [changingRating, setChangingRating] = useState(false);
  const [ratingSaved, setRatingSaved] = useState<string | null>(null); // dish id, transient

  // Retro dish-identity check. The /log flow only asks "same dish as X?" when a
  // dish's rating screen opens — so every dish rated BEFORE the identity pipeline
  // shipped (July 13) structurally never gets asked, which is exactly how the
  // 蝦餃 / 水晶鮮蝦餃 pair at 美心皇宮 stayed fragmented. This sweep probes the
  // already-rated, still-unlinked dishes when the list loads, and surfaces at
  // most ONE quiet confirm at a time. Sequential and capped: each probe may cost
  // an LLM adjudication server-side, and dismissed pairs are filtered before
  // adjudication, so a "no" is never paid for twice.
  const [identityAsk, setIdentityAsk] = useState<{
    dish: MyDish; suggestion: { dish_id: string; name: string; name_zh: string | null };
  } | null>(null);
  const [identityBusy, setIdentityBusy] = useState(false);
  const identitySweepDone = useRef(false);

  useEffect(() => {
    if (!dishes || identitySweepDone.current) return;
    identitySweepDone.current = true;
    // Oldest-first, not newest-first: the whole point of this sweep is clearing
    // the backlog of dishes rated BEFORE the identity pipeline existed (July 13)
    // — newly-rated dishes already get checked live in /log and don't need this.
    // Cap at 20 rather than 6: the first real production check showed 13 dishes
    // in the current backlog, and a newest-first-with-cap-6 sweep silently never
    // reached position 7 — which is exactly where the real 蝦餃/水晶鮮蝦餃 pair sat.
    // Excludes dish_identity_checked_at: without this, a genuine singleton (真係
    // 冚唪唥都冇撞名嘅嘢) gets re-probed — and re-billed for LLM adjudication — on
    // every single Taste-tab visit forever, since it will never gain a real link.
    const unlinked = dishes
      .filter(d => d.restaurant_id && !d.dish_identity_id && !d.dish_identity_checked_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 20);
    if (unlinked.length === 0) return;
    let cancelled = false;
    (async () => {
      // Parallel, not sequential: a sequential await-per-dish loop was too slow to
      // finish within a normal visit — real logs showed it getting interrupted by
      // navigation (component unmount) after only 4-5 of the up-to-20 checks, and
      // since the sweep restarts from position 1 on every remount, it kept
      // re-checking the same early dishes and never reached where the real pair
      // sat (position 6-7). All checks fire together; gate 1 is free and gate 2 is
      // the only real latency, so this finishes in one round-trip either way.
      const results = await Promise.all(unlinked.map(async d => {
        try {
          const res = await fetch(`/api/dishes/identity?dish_id=${d.id}`);
          const j = await res.json();
          return j.suggestion ? { dish: d, suggestion: j.suggestion } : null;
        } catch { return null; }
      }));
      if (cancelled) return;
      const first = results.find(r => r !== null);
      if (first) setIdentityAsk(first);
    })();
    return () => { cancelled = true; };
  }, [dishes]);

  async function answerIdentityAsk(same: boolean) {
    if (!identityAsk) return;
    setIdentityBusy(true);
    try {
      await fetch('/api/dishes/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dish_id: identityAsk.dish.id,
          same_as_dish_id: same ? identityAsk.suggestion.dish_id : undefined,
          not_same_as_dish_id: same ? undefined : identityAsk.suggestion.dish_id,
        }),
      });
      if (same) {
        // Refetch rather than patch locally: a real merge changes more than
        // just this dish's own dish_identity_id (the OTHER dish gets linked
        // too, and the identity's canonical name comes from the server's
        // authority ladder) — a local patch can't know either of those, so
        // pulling the real row is what actually makes the group and its
        // name show up immediately instead of only after the next reload.
        refetchFirstPage();
      }
    } catch { /* a failed answer just means it may be asked again later */ }
    setIdentityAsk(null);
    setIdentityBusy(false);
  }

  const refetchFirstPage = useCallback(() => {
    fetch('/api/my/dishes?rated=1')
      .then(r => r.json())
      .then(j => { setDishes(j.dishes ?? []); setHasMore(!!j.has_more); })
      .catch(() => setDishes([]));
  }, []);

  // Load only on the first visit of the session; a cached return already has its rows
  // in state. "Scroll down to reload" is the browser's own pull-to-refresh — a full
  // reload tears down the heap, dropping the cache, so the next mount refetches.
  useEffect(() => {
    if (getJournalCache()) return;
    refetchFirstPage();
  }, [refetchFirstPage]);

  // Mirror the live list back into the module cache so a tab switch restores exactly
  // what was on screen — in-journal edits and any extra pages scrolled in included.
  useEffect(() => {
    if (dishes !== null) setJournalCache({ dishes, hasMore });
  }, [dishes, hasMore]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !dishes || dishes.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = dishes[dishes.length - 1].created_at;
      const res = await fetch(`/api/my/dishes?rated=1&before=${encodeURIComponent(cursor)}`);
      const json = await res.json();
      setDishes(prev => [...(prev ?? []), ...(json.dishes ?? [])]);
      setHasMore(!!json.has_more);
    } finally {
      setLoadingMore(false);
    }
  }, [dishes, hasMore, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function startEdit(d: MyDish) {
    setEditing(d.id);
    setDraftName(d.name);
    setDraftNameZh(d.name_zh ?? '');
    setEditedEn(false); setEditedZh(false);
    setSaveError(null);
    setChangingRestaurant(false); setDraftRestaurant(null);
    setChangingRating(false);
  }

  async function rename(id: string) {
    const name = draftName.trim();
    const name_zh = draftNameZh.trim();
    // The name fields are PRE-FILLED with the dish's existing names, so "there is
    // text in them" says nothing about whether the person changed anything. Only
    // the edited flags do. Sending the names regardless made a restaurant-only
    // edit look like a rename to the server, which stamped name_edited_at and
    // silently demoted a menu-scan name from AUTHORITY_MENU to AUTHORITY_HUMAN —
    // corrupting dish-identity naming for a name nobody actually touched.
    const wantsNameChange = (editedEn || editedZh) && (!!name || !!name_zh);
    const wantsRestaurantChange = changingRestaurant && draftRestaurant !== null;
    if (!wantsNameChange && !wantsRestaurantChange) { setEditing(null); return; }
    setSaving(true); setSaveError(null);
    const res = await fetch('/api/my/dishes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dish_id: id,
        name: wantsNameChange ? (name || undefined) : undefined,
        name_zh: wantsNameChange ? (name_zh || null) : undefined,
        edited_en: editedEn, edited_zh: editedZh,
        restaurant_id: wantsRestaurantChange && draftRestaurant?.kind === 'existing' ? draftRestaurant.id : undefined,
        new_restaurant: wantsRestaurantChange && draftRestaurant?.kind === 'new' ? draftRestaurant : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setSaveError(json.error ?? 'Could not save.');
      return;
    }
    const { dish, relearned } = await res.json();
    setDishes(prev => prev?.map(d => d.id === id
      ? { ...d, name: dish.name, name_zh: dish.name_zh, cuisine: dish.cuisine, restaurant: dish.restaurant ?? d.restaurant }
      : d) ?? null);
    setEditing(null);
    if (relearned) {
      setRelearnedId(id);
      setTimeout(() => setRelearnedId(null), 4000);
    }
  }

  /** Re-flicking a dish's rating is a fresh call to the same rating endpoint a
   * first-time rating uses — upsert semantics mean this genuinely IS "the new
   * rating" afterward, not a parallel "edited rating" concept to keep in sync. */
  async function updateRating(id: string, score: number) {
    setDishes(prev => prev?.map(d => d.id === id ? { ...d, my_score: score } : d) ?? null);
    setRatingSaved(null);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: id, score }),
      });
      if (res.ok) {
        setRatingSaved(id);
        setTimeout(() => setRatingSaved(prev => (prev === id ? null : prev)), 2500);
      }
    } catch { /* the flick gesture already gave visual feedback; a failed save
      just means the number reverts on next real fetch — not worth a hard error
      for a single re-rate */ }
    setChangingRating(false);
  }

  /** Set/clear a dish's when-eaten date from the card's tappable date. dateStr is
   * yyyy-mm-dd from the native input (''=clear); stored at local noon so the
   * calendar day can't drift across time zones. Optimistic — personal metadata,
   * its own endpoint (no lock/replay), reverts on next fetch if the save fails. */
  async function setEaten(id: string, dateStr: string) {
    const iso = dateStr ? new Date(`${dateStr}T12:00:00`).toISOString() : null;
    setDishes(prev => prev?.map(d => d.id === id ? { ...d, eaten_at: iso } : d) ?? null);
    try {
      await fetch('/api/dishes/eaten-date', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: id, eaten_at: iso }),
      });
    } catch { /* optimistic; reverts on next real fetch */ }
  }

  async function remove(id: string) {
    if (!confirm(t('home.delete.confirm'))) return;
    const prevDishes = dishes;
    setDishes(prev => prev?.filter(d => d.id !== id) ?? null);
    const res = await fetch('/api/my/dishes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: id }),
    });
    if (!res.ok) setDishes(prevDishes);
  }

  if (dishes === null) return <JournalSkeleton />; // loading: shape now, not a blank flash
  if (dishes.length === 0) return null;

  // Group linked dishes together so a confirmed "same dish" actually shows up
  // as something, instead of the merge being invisible in the journal (the
  // server-side link was already correct — dish_identity_id gets set on both
  // rows immediately — this was purely a missing display step). Each
  // occurrence keeps its own photo/rating/edit/delete untouched: two ratings
  // of the same real-world dish are still two real, separate memories, not
  // duplicate data to collapse away.
  const seenIdentity = new Set<string>();
  const groups: MyDish[][] = [];
  for (const d of dishes) {
    const key = d.dish_identity_id;
    if (key && key !== 'linked' && seenIdentity.has(key)) continue;
    if (key && key !== 'linked') {
      seenIdentity.add(key);
      groups.push(dishes.filter(x => x.dish_identity_id === key));
    } else {
      groups.push([d]);
    }
  }

  return (
    <>
      {identityAsk && (
        <div className="card"><div className="card-body">
          <p className="card-meta" style={{ marginBottom: 4 }}>
            {t('log.samedish.title', { restaurant: identityAsk.dish.restaurant ?? '' })}
          </p>
          <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>
            {t('log.samedish.pair', {
              a: (lang === 'zh' && identityAsk.dish.name_zh) ? identityAsk.dish.name_zh : identityAsk.dish.name,
              b: (lang === 'zh' && identityAsk.suggestion.name_zh) ? identityAsk.suggestion.name_zh : identityAsk.suggestion.name,
            })}
          </p>
          <p style={{ fontWeight: 650, fontSize: 15, marginBottom: 12 }}>{t('log.samedish.q')}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary large" disabled={identityBusy} onClick={() => answerIdentityAsk(true)}>
              {t('log.samedish.yes')}
            </button>
            <button className="btn ghost large" disabled={identityBusy} onClick={() => answerIdentityAsk(false)}>
              {t('log.samedish.no')}
            </button>
          </div>
        </div></div>
      )}
      {groups.map(group => {
        const rows = group.map(d => {
        const bucket = cookingBucket(d.cooking_method as CookingMethod | null | undefined);
        const bucketText = bucket ? t(`scan.bucket.${bucket}`) : null;
        return (
        <article className="rated-dish-row" key={d.id}>
          <div className="card-body journal-row">
            {/* Left column: the dish photo (or a soft placeholder when a dish
                was rated without one), with the verdict word directly beneath
                it — per the design, the rating belongs under the photo, not
                inline with the name. */}
            <div className="journal-photo-col">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo_url} alt={d.name} className="journal-photo" />
              ) : (
                // Placeholder stays exactly where the photo would be — and doubles
                // as a tap target to add one (this dish was a menu pick rated with
                // no photo). A hidden file input keeps it a single tap on mobile.
                <label className="journal-photo journal-photo-empty journal-photo-add"
                  title={t('home.addphoto')} aria-label={t('home.addphoto')}>
                  <input type="file" accept="image/*" hidden disabled={photoUploadingId === d.id}
                    onChange={e => addPhoto(d.id, e.target.files?.[0] ?? null)} />
                  <span aria-hidden>{photoUploadingId === d.id ? '…' : '+'}</span>
                </label>
              )}
              {editing !== d.id && d.my_score !== null && (
                <div className="journal-verdict">{t(wordKeyFor(d.my_score))}</div>
              )}
            </div>

            <div className="journal-info">
              {editing === d.id ? (
                <div>
                  {/* Chinese first — matches the app's default display language
                      and the same ordering used in /log's name editor, so the
                      two rename experiences don't quietly disagree with each
                      other about which field comes first. */}
                  {d.dish_identity_id ? (
                    // A linked dish's name is governed by its shared identity (the
                    // menu-scan / owner name wins), so it isn't editable per-row —
                    // editing one occurrence's name would re-fragment the dish. The
                    // restaurant and rating below are still editable.
                    <p className="card-meta" style={{ marginBottom: 4 }}>{t('home.name.locked')}</p>
                  ) : (
                    <>
                      <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.zh')}</label>
                      <input className="field" style={{ marginBottom: 6 }} value={draftNameZh} autoFocus
                        placeholder={editedEn && !editedZh ? t('log.willTranslate') : undefined}
                        onChange={e => { setDraftNameZh(e.target.value); setEditedZh(true); if (!editedEn) setDraftName(''); }} />
                      <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.en')}</label>
                      <input className="field" value={draftName} placeholder={editedZh && !editedEn ? t('log.willTranslate') : undefined}
                        onChange={e => { setDraftName(e.target.value); setEditedEn(true); if (!editedZh) setDraftNameZh(''); }} />
                      <p className="card-meta" style={{ marginTop: 4 }}>{t('home.translateOnSave')}</p>
                    </>
                  )}

                  {/* Restaurant + rating: collapsed toggles, not always-on UI. */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="btn ghost small" onClick={() => setChangingRestaurant(v => !v)}>
                      {t('home.changerestaurant')}
                    </button>
                    <button className="btn ghost small" onClick={() => setChangingRating(v => !v)}>
                      {t('home.changerating')}
                    </button>
                  </div>
                  {changingRestaurant && (
                    <div style={{ marginTop: 8 }}>
                      <RestaurantPicker onChange={setDraftRestaurant} />
                    </div>
                  )}
                  {changingRating && (
                    <div style={{ marginTop: 8 }}>
                      <FlickRating photoUrl={d.photo_url} dishName={d.name} dishNameZh={d.name_zh} onRate={score => updateRating(d.id, score)} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="btn primary small" disabled={saving} onClick={() => rename(d.id)}>
                      {saving ? t('home.saving') : t('home.save')}
                    </button>
                    <button className="btn ghost small" disabled={saving} onClick={() => setEditing(null)}>{t('home.cancel')}</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* When-EATEN date (not when-logged): shown from photo EXIF when
                      known, else a tappable "某年某月某日" placeholder. The list order
                      stays logged (created_at) — your album is already chronological;
                      Dishi just surfaces the diary date, editable via a native picker. */}
                  <label className="journal-date journal-date-edit" onClick={e => e.stopPropagation()}>
                    {d.eaten_at ? formatEatenDate(d.eaten_at, infoLang) : t('journal.setdate')}
                    <input
                      type="date" className="journal-date-input"
                      value={d.eaten_at ? toDateInputValue(d.eaten_at) : ''}
                      max={toDateInputValue(new Date().toISOString())}
                      onChange={e => setEaten(d.id, e.target.value)}
                      aria-label={t('journal.setdate')}
                    />
                  </label>
                  {/* A linked dish's stored name is already the canonical name
                      (kept in sync server-side on link/owner-adopt), so the row's
                      own name is the right thing to show. */}
                  <div className="card-title"><DishName id={d.id} name={d.name} name_zh={d.name_zh} /></div>
                  <div className="dish-meta">
                    {[locationLabel(d, t('home.homecooking'), lang), cuisineLabel(d.cuisine, lang), bucketText]
                      .filter(Boolean).join(' · ')}
                  </div>

                  {/* Same diet/heaviness chips the menu-scan card uses — one shared
                      component. The cooking-style hook is hidden here (hideHook)
                      because it now lives inline in the meta line above. */}
                  <DishInfoDisplay info={d} compact hideHook />
                </>
              )}

              {relearnedId === d.id && (
                <p className="card-meta" style={{ color: 'var(--ink)', fontSize: 12.5, marginTop: 4 }}>{t('log.relearned')}</p>
              )}
              {ratingSaved === d.id && (
                <p className="card-meta" style={{ color: 'var(--ink)', fontSize: 12.5, marginTop: 4 }}>{t('home.ratingsaved')}</p>
              )}
              {editing === d.id && saveError && (
                <p style={{ color: 'var(--lacquer)', fontSize: 12.5, marginTop: 4 }}>{saveError}</p>
              )}
            </div>

            {/* Kebab, pinned top-right of the row: tap opens a small menu to
                choose edit or delete. Hidden while editing or when the dish is
                locked (someone else has rated it). */}
            {editing !== d.id && !d.locked && (
              <div className="dish-actions">
                <button className="icon-btn lg" onClick={() => setMenuOpenId(v => v === d.id ? null : d.id)}
                  aria-label={t('home.more')} title={t('home.more')} aria-haspopup="menu" aria-expanded={menuOpenId === d.id}>
                  <MoreIcon size={20} />
                </button>
                {menuOpenId === d.id && (
                  <>
                    <div className="row-menu-backdrop" onClick={() => setMenuOpenId(null)} aria-hidden />
                    <div className="row-menu" role="menu">
                      <button role="menuitem" onClick={() => { setMenuOpenId(null); startEdit(d); }}>
                        <EditIcon size={16} /> {t('home.edit')}
                      </button>
                      <button role="menuitem" onClick={() => { setMenuOpenId(null); remove(d.id); }}>
                        <TrashIcon size={16} /> {t('home.delete')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {editing !== d.id && d.locked && (
              <span className="journal-locked" title={t('home.locked')} aria-label={t('home.locked')} />
            )}
          </div>
        </article>
        );
        });
        // No special grouping visual: linked occurrences already read as the same
        // dish because they share the canonical name (above), so a red-line block
        // and a "recorded N times" header were redundant chrome. Each occasion is
        // still its own row with its own photo/rating/actions.
        return rows;
      })}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
      {loadingMore && <p className="card-meta" style={{ textAlign: 'center', padding: '8px 0' }}>{t('home.loadingmore')}</p>}
    </>
  );
}
