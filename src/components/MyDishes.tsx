'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import DishName from '@/components/DishName';
import RestaurantPicker, { RestaurantChoice } from '@/components/RestaurantPicker';
import FlickRating from '@/components/FlickRating';
import { cuisineLabel } from '@/lib/i18n';
import { wordKeyFor } from '@/lib/flickWords';
import { EditIcon, TrashIcon, MoreIcon, CheckIcon, CloseIcon, GlobeIcon, ShareIcon } from './icons';
import { shareLink } from '@/lib/share';
import Toast, { useToast } from '@/components/Toast';
import { cookingBucket, type CookingMethod } from '@/lib/menuScan';
import DishInfoDisplay from './DishInfoDisplay';
import ExplainModal from './ExplainModal';
import { normalizePhoto } from '@/lib/image';
import { getJournalCache, setJournalCache } from '@/lib/journalCache';
import { pickDistrict, type DistrictMap } from '@/lib/district';
import Chop from './Chop';
import { chopColorFor } from '@/lib/chop';
import IdentityConfirmCard from './IdentityConfirmCard';
import PostSheet from './PostSheet';
import type { DuelDish } from './DuelSide';
import { identityRecheckDue } from '@/lib/dishIdentity';

export type MyDish = {
  id: string; name: string; name_zh: string | null; cuisine: string | null;
  photo_url: string | null; restaurant: string | null; hearts: number; my_score: number | null;
  locked: boolean; created_at: string; eaten_at?: string | null;
  restaurant_area?: string | null; source?: string | null;
  district?: DistrictMap | null; restaurant_district?: DistrictMap | null;
  lat?: number | null; lng?: number | null; // photo EXIF coords → seed "switch restaurant"
  restaurant_id?: string | null; dish_identity_id?: string | null;
  dish_identity_checked_at?: string | null;
  identity_name?: string | null; identity_name_zh?: string | null;
  cooking_method?: string | null; heaviness?: string | null; diet?: string[] | null;
  /** 同檯 companions (Table Mode item 4): who shared the table when this dish
   * was picked — same chop identity (display_name, else handle) the table's
   * own live stamps used. user_id seeds the chop color (color is f(user_id),
   * never f(name)). Empty/absent for solo dishes. */
  companions?: { user_id?: string; name: string }[];
  /** 貼文 state: whether this dish is public, and the line published with it.
   * Per-dish opt-in is the product's consent unit — see lib/posts.ts. */
  posted?: boolean;
  post_visibility?: 'public' | 'link' | null;
  post_reason?: string | null;
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
 * 2026年7月12日 / Jul 12, 2026. */
function formatEatenDate(iso: string, lang: 'zh' | 'en'): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return lang === 'zh'
    ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
 * real row layout, so the page has shape immediately instead of a blank flash.
 * Exported: page.tsx's AuthGate fallback reuses this SAME skeleton (not a
 * lookalike) so the sign-in check and the data fetch read as one continuous
 * loading state instead of two different placeholders back to back. */
export function JournalSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
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
export default function MyDishes({ t, lang, onPublished }: {
  t: (k: string, p?: Record<string, string | number>) => string; lang: 'zh' | 'en';
  /** Fired after a successful PUBLISH (PostSheet's onSaved with posted=true)
   * — never on unpublish. Lets the page switch itself to 大家食, the tab
   * that now actually shows the thing that just happened. */
  onPublished?: () => void;
}) {
  // Restore the list from the module cache on mount (lazy initializers, so this reads
  // the snapshot once). A tab switch away and back lands here with the rows already in
  // state — no skeleton, no refetch. First-ever load (no cache) starts null → skeleton.
  const [dishes, setDishes] = useState<MyDish[] | null>(() => getJournalCache()?.dishes ?? null);
  const [editing, setEditing] = useState<string | null>(null);
  // Which row's "more actions" (edit/delete) menu is currently open — a single
  // kebab button replaces the previous always-visible edit+delete icon pair,
  // per the decided design; at most one row's menu is open at a time.
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // The share confirmation — the same pill the table bar shows, replacing the
  // window.alert this used to raise for a link that was already on the clipboard.
  // It hangs off the ROW that was shared (owner, 2026-07-31: sharing row 1 must
  // not confirm at the bottom of the screen), so the pill needs to know which one
  // — a list-level message with no row identity can only float.
  const toast = useToast();
  const [toastDishId, setToastDishId] = useState<string | null>(null);
  const dismissToast = useCallback(() => { toast.onDone(); setToastDishId(null); }, [toast]);
  // Which dish's 貼文 sheet is open. Publishing is a deliberate, separate act —
  // never a side effect of rating or editing. The sheet only ever serves the
  // publish act now — Share (owner call: simplified) no longer opens it.
  const [posting, setPosting] = useState<MyDish | null>(null);
  // Shown when Share is tapped by someone who never claimed a username: the
  // link is dishi.me/<name>/d/<dish>, so there is no URL to send without one.
  const [shareNeedsName, setShareNeedsName] = useState(false);
  // Which photoless row is currently uploading a just-picked photo — so its
  // placeholder can show a "saving" state instead of silently doing nothing.
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);

  /** Resolve one dish's public permalink. The username comes from /api/buddy's
   * identity block (where it already rides, rather than on its own endpoint)
   * and is fetched at tap time — this list has no reason to hold identity
   * state for an action most rows never take.
   *
   * Only a CLAIMED username resolves publicly, so an unclaimed person has no
   * link to send; null tells the caller to say so rather than hand out a URL
   * that 404s. */
  async function resolveDishUrl(dishId: string): Promise<string | null> {
    let username: string | null = null;
    try {
      const res = await fetch('/api/buddy');
      const json = await res.json().catch(() => null);
      if (json?.identity?.claimed) username = json.identity.username ?? null;
    } catch { /* offline — handled as "no name" below */ }
    return username ? `${window.location.origin}/${username}/d/${dishId}` : null;
  }

  /** Send the permalink for one dish — OS share sheet first, clipboard second
   * (lib/share.ts). */
  async function sendDishLink(dishId: string) {
    const url = await resolveDishUrl(dishId);
    if (!url) { setShareNeedsName(true); return; }
    if (await shareLink({ title: t('post.share.title'), url }) === 'copied') {
      setToastDishId(dishId);
      toast.show(t('share.linkcopied'));
    }
  }

  /** The kebab's "分享" — simplified (owner call): no consent card, no
   * comment prompt. An unposted dish is silently upgraded to a link-only
   * post first (mergeVisibility server-side never downgrades an already-
   * public one), then the permalink goes straight to the OS share sheet. */
  async function shareDish(d: MyDish) {
    if (!d.posted) {
      try {
        const res = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish_id: d.id, reason: null, visibility: 'link' }),
        });
        if (!res.ok) return;
        const saved = await res.json().catch(() => null);
        setDishes(prev => prev?.map(x => x.id === d.id
          ? { ...x, posted: true, post_reason: null, post_visibility: saved?.post?.visibility ?? 'link' }
          : x) ?? null);
      } catch { return; }
    }
    sendDishLink(d.id);
  }

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
  // 略過/住家菜 as an ANSWER: "this dish's restaurant is wrong and none of these is
  // right." Tracked separately because both chips report the same null choice the
  // picker also sends for ordinary bookkeeping (opening the add form un-picks a
  // chip), and null alone read as "nothing to save" — which is why a dish
  // attributed 1836m away could not be un-attributed from the very editor offering
  // to fix it. Blank beats wrong.
  const [clearRestaurant, setClearRestaurant] = useState(false);
  const [changingRating, setChangingRating] = useState(false);
  const [ratingSaved, setRatingSaved] = useState<string | null>(null); // dish id, transient

  // Retro dish-identity check. The live ask happens at LOG time now (the growth
  // screen's 係咪同一味 card, via RatingStack) — this sweep covers everything
  // that path structurally misses: dishes rated before the identity pipeline
  // existed, dishes whose lookalike arrived LATER, and pairs whose earlier
  // answer was an expiring 唔肯定. Probes when the list loads; surfaces at most
  // ONE confirm at a time. Each probe may cost an LLM adjudication server-side,
  // and answered pairs are filtered before adjudication, so a settled verdict
  // is never paid for twice.
  const [identityAsk, setIdentityAsk] = useState<{
    dish: MyDish; suggestion: { dish_id: string; name: string; name_zh: string | null; photo_url?: string | null; restaurant?: string | null };
  } | null>(null);
  const identitySweepDone = useRef(false);
  // True while THIS component is genuinely mounted — set in an effect (not just
  // the initializer) so StrictMode's simulated unmount/remount lands back on
  // true. The sweep result below checks this instead of a per-run `cancelled`
  // flag: the journal sets `dishes` more than once in a normal load (cache
  // first, fresh fetch after), and a cleanup-scoped cancel let that refresh
  // silently discard the in-flight suggestion every time — the card never
  // showed. Only a REAL unmount should drop it.
  const identityMounted = useRef(true);
  useEffect(() => {
    identityMounted.current = true;
    return () => { identityMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!dishes || identitySweepDone.current) return;
    identitySweepDone.current = true;
    // Oldest-first, not newest-first: the whole point of this sweep is clearing
    // the backlog — newest dishes were already asked at log time.
    // Cap at 20 rather than 6: the first real production check showed 13 dishes
    // in the current backlog, and a newest-first-with-cap-6 sweep silently never
    // reached position 7 — which is exactly where the real 蝦餃/水晶鮮蝦餃 pair sat.
    // identityRecheckDue: a "checked, nothing found" stamp blocks re-probing (a
    // genuine singleton must not be re-billed every visit) but REOPENS after the
    // cooldown window — a dish that gains a lookalike later, or whose pair got an
    // expiring 唔肯定, would otherwise never be askable again.
    const unlinked = dishes
      .filter(d => d.restaurant_id && !d.dish_identity_id && identityRecheckDue(d.dish_identity_checked_at))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 20);
    if (unlinked.length === 0) return;
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
      if (!identityMounted.current) return; // real unmount only — see identityMounted
      const first = results.find(r => r !== null);
      if (first) setIdentityAsk(first);
    })();
  }, [dishes]);

  // The card (IdentityConfirmCard) owns the POST and the result strip; all this
  // mount decides is what happens AFTER: a real merge refetches (the canonical
  // name and the OTHER dish's link both changed server-side in ways a local
  // patch can't know), everything else just clears the ask.
  function identityAskDone(outcome: 'same' | 'different' | 'unsure') {
    if (outcome === 'same') refetchFirstPage();
    setIdentityAsk(null);
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
    setChangingRestaurant(false); setDraftRestaurant(null); setClearRestaurant(false);
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
    const wantsRestaurantChange = changingRestaurant && (draftRestaurant !== null || clearRestaurant);
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
        clear_restaurant: wantsRestaurantChange && clearRestaurant ? true : undefined,
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
      ? {
        ...d, name: dish.name, name_zh: dish.name_zh, cuisine: dish.cuisine,
        // `?? d.restaurant` keeps the old value when the server simply didn't
        // speak about the restaurant — but a CLEAR is the server speaking, and
        // the fallback would silently redisplay the attribution just removed.
        restaurant: clearRestaurant ? null : (dish.restaurant ?? d.restaurant),
      }
      : d) ?? null);
    setClearRestaurant(false);
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
        // A re-rate should never find a pending seal — seals are only ever created
        // for UNRATED dishes (scan pick time, and the 待評 list's lazy seal), and
        // this list is rated dishes by definition. But `revealed_at` is one-way, so
        // "shouldn't happen" is not a safe reason to discard the response: if a
        // fourth seal-creation site ever appears, silently swallowing the reveal
        // here would be the 2026-07-24 bug again. Leave it recoverable instead —
        // NOT marked displayed, so the next rating session picks it up via
        // /api/seals/displayed rather than it being lost.
        const json = await res.json().catch(() => null);
        if (json?.seal?.id) {
          console.warn('[seal] re-rate broke a pending seal — left recoverable', json.seal.id);
        }
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

  // Stagger each row's entrance below (see .rated-dish-row's CSS animation) — the
  // data already arrived in one batched fetch; this only spreads the REVEAL so it
  // reads as progressive, without reintroducing per-dish network round trips.
  let rowIdx = 0;
  return (
    <>
      {/* 係咪同一味？ — the SAME IdentityConfirmCard the growth screen mounts at
          log time (one card, two mount points — never a lookalike). The plain
          yes/no text card that used to live here was replaced by the duel-chassis
          card when it shipped (backlog 2026-07-22). */}
      {identityAsk && (
        <IdentityConfirmCard
          mine={{
            id: identityAsk.dish.id, name: identityAsk.dish.name, name_zh: identityAsk.dish.name_zh,
            photo_url: identityAsk.dish.photo_url,
            restaurant: identityAsk.dish.restaurant,
            restaurant_district: identityAsk.dish.restaurant_district ?? null,
          } satisfies DuelDish}
          other={{
            id: identityAsk.suggestion.dish_id, name: identityAsk.suggestion.name,
            name_zh: identityAsk.suggestion.name_zh,
            photo_url: identityAsk.suggestion.photo_url ?? null,
            restaurant: identityAsk.suggestion.restaurant ?? identityAsk.dish.restaurant,
            restaurant_district: identityAsk.dish.restaurant_district ?? null, // same restaurant, by construction
          } satisfies DuelDish}
          onDone={identityAskDone}
        />
      )}
      {shareNeedsName && (
        <ExplainModal
          title={t('post.share.needname.title')}
          body={t('post.share.needname.body')}
          onClose={() => setShareNeedsName(false)}
        />
      )}
      {posting && posting.my_score !== null && (
        <PostSheet
          dish={{
            id: posting.id, name: posting.name, name_zh: posting.name_zh,
            score: posting.my_score, posted: !!posting.posted, reason: posting.post_reason ?? null,
            photo_url: posting.photo_url,
          }}
          onClose={() => setPosting(null)}
          onSaved={(id, posted, reason, visibility) => {
            setDishes(prev => prev?.map(x => x.id === id
              ? { ...x, posted, post_reason: reason, post_visibility: posted ? (visibility ?? 'public') : null }
              : x) ?? null);
            // Publish, not unpublish — the tab switch only fires on the act
            // that actually put something on 大家食.
            if (posted) onPublished?.();
          }}
        />
      )}
      {groups.map(group => {
        const rows = group.map(d => {
        const bucket = cookingBucket(d.cooking_method as CookingMethod | null | undefined);
        const bucketText = bucket ? t(`scan.bucket.${bucket}`) : null;
        // Capped at 8 rows' worth: rows further down need a scroll to even see,
        // so delaying them further buys nothing.
        const rowDelay = Math.min(rowIdx++, 8) * 35;
        return (
        // .rated-dish-row's entrance animation ends with `transform: none`,
        // but a CSS animation never truly releases a property it touched —
        // even holding "none" via fill-mode:both, the computed value stays a
        // resolved identity matrix rather than the literal keyword, which
        // silently makes the row a containing block for any position:fixed
        // descendant (a .row-menu-backdrop can't reach the full viewport
        // anymore, so tapping outside the row no longer dismisses its menu or
        // the link-copied popup). Detaching the animation once it's actually
        // done restores a genuine `transform: none`.
        <article className="rated-dish-row" key={d.id} style={{ animationDelay: `${rowDelay}ms` }}
          onAnimationEnd={e => { e.currentTarget.style.animation = 'none'; }}>
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
                      <div className="name-edit-labelrow">
                        <label className="label" style={{ fontSize: 11.5, margin: 0 }}>{t('home.name.zh')}</label>
                        <span className="card-meta name-edit-note">{t('home.translateOnSave')}</span>
                      </div>
                      <input className="field" style={{ marginBottom: 6 }} value={draftNameZh} autoFocus
                        placeholder={editedEn && !editedZh ? t('log.willTranslate') : undefined}
                        onChange={e => { setDraftNameZh(e.target.value); setEditedZh(true); if (!editedEn) setDraftName(''); }} />
                      <label className="label" style={{ fontSize: 11.5 }}>{t('home.name.en')}</label>
                      <input className="field" value={draftName} placeholder={editedZh && !editedEn ? t('log.willTranslate') : undefined}
                        onChange={e => { setDraftName(e.target.value); setEditedEn(true); if (!editedZh) setDraftNameZh(''); }} />
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
                      {/* Seed from WHERE THE PHOTO WAS TAKEN (stored EXIF coords), not the
                          device's live GPS — this is a retrospective edit, the person is
                          almost never standing where they ate. photoOnly kills the live-GPS
                          fallback outright: with it, a dish that kept its EXIF got
                          photo-location suggestions and one that didn't got wherever-you-are-
                          now suggestions, so the same shortlist silently meant two different
                          things. EXIF or nothing here; live GPS stays reachable inside the add
                          form, on an explicit tap, purely to PIN a newly typed place. */}
                      <RestaurantPicker
                        // 住家菜 arrives here as {kind:'home'} while 略過 arrives via
                        // onNone — different routes, same meaning for this dish: no
                        // restaurant. A real pick supersedes an earlier 略過.
                        onChange={c => { setDraftRestaurant(c); setClearRestaurant(c?.kind === 'home'); }}
                        onNone={() => setClearRestaurant(true)}
                        photoOnly
                        seedCoords={d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null}
                      />
                    </div>
                  )}
                  {changingRating && (
                    <div style={{ marginTop: 8 }}>
                      <FlickRating photoUrl={d.photo_url} dishName={d.name} dishNameZh={d.name_zh} onRate={score => updateRating(d.id, score)} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="icon-btn cancel" disabled={saving}
                      onClick={() => setEditing(null)} aria-label={t('home.cancel')} title={t('home.cancel')}>
                      <CloseIcon size={16} />
                    </button>
                    {/* Vermillion once anything actually changed — a typed name or a
                        picked restaurant — so "unsaved edits" reads at a glance. */}
                    <button
                      className={`icon-btn save ${
                        ((editedEn || editedZh) && (draftName.trim() || draftNameZh.trim())) ||
                        (changingRestaurant && (draftRestaurant !== null || clearRestaurant))
                          ? 'dirty' : ''
                      }`}
                      disabled={saving} onClick={() => rename(d.id)}
                      aria-label={saving ? t('home.saving') : t('home.save')} title={t('home.save')}>
                      {saving ? <span className="icon-btn-spinner" aria-hidden /> : <CheckIcon size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* When-EATEN date (not when-logged): shown from photo EXIF when
                      known, else a tappable "某年某月某日" placeholder. The list order
                      stays logged (created_at) — your album is already chronological;
                      Dishi just surfaces the diary date, editable via a native picker. */}
                  <label className="journal-date journal-date-edit" onClick={e => e.stopPropagation()}>
                    {d.eaten_at ? formatEatenDate(d.eaten_at, lang) : t('journal.setdate')}
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

                  {/* 同檯 companions (Table Mode item 4): the same Chop the table's
                      live stamps rendered, so the meal's people carry into its
                      diary. Quiet label + chips, no counts — presence, not score. */}
                  {(d.companions?.length ?? 0) > 0 && (
                    <div className="chop-stamp-row" style={{ marginTop: 6 }}
                      aria-label={t('journal.companions')} title={t('journal.companions')}>
                      <span className="card-meta" style={{ marginRight: 2 }}>{t('journal.companions')}</span>
                      {d.companions!.slice(0, 5).map(c => (
                        // Color from user_id (name only as a legacy fallback seed
                        // for rows cached before user_id rode along) — same
                        // companion, same color, here and at the live table.
                        <Chop key={c.user_id ?? c.name} name={c.name} color={chopColorFor(c.user_id ?? c.name)} size={22} />
                      ))}
                      {d.companions!.length > 5 && (
                        <span className="chop-stamp-overflow">+{d.companions!.length - 5}</span>
                      )}
                    </div>
                  )}
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
                locked (someone else has rated it). The globe/link badge is a
                PURE STATUS glyph — non-interactive, no onClick — telling you
                this dish is posted to 大家食 without opening anything. It must
                never be tappable-to-copy again: that conflated "this is
                published" with the Share act, which is its own separate thing
                (the kebab's own "分享" item, simplified to go straight to the
                OS share sheet with no card). */}
            {editing !== d.id && !d.locked && (
              <div className="dish-actions">
                {/* Only 公開 earns a badge. The link-only glyph is gone (owner,
                    2026-07-31) — it read as a second, confusable "published"
                    marker beside the globe, and it had stopped meaning what a
                    badge should mean: Share silently upgrades an unposted dish to
                    link-only (see shareDish), so simply SENDING a dish to someone
                    stamped it as though the person had published it. A badge
                    should report a decision they made, and link-only is no longer
                    one. This knowingly reverses 152a4ec, which restored the glyph
                    on the grounds that the two promises must not render alike —
                    still true, and now honoured by only one of them rendering.
                    The promise itself is unchanged: visibility is still 'link' vs
                    'public' server-side, and the kebab still says which. */}
                {d.posted && d.post_visibility !== 'link' && (
                  <span className="dish-public-badge" aria-label={t('post.public')} title={t('post.public')}>
                    <GlobeIcon size={16} />
                  </span>
                )}
                <button className="icon-btn lg" onClick={() => setMenuOpenId(v => v === d.id ? null : d.id)}
                  aria-label={t('home.more')} title={t('home.more')} aria-haspopup="menu" aria-expanded={menuOpenId === d.id}>
                  <MoreIcon size={20} />
                </button>
                {/* Hangs under THIS row's kebab — .dish-actions is position:relative,
                    and anchoring right keeps it growing into the screen rather than
                    off the edge, the same way .row-menu itself hangs. */}
                {toastDishId === d.id && (
                  <Toast message={toast.message} onDone={dismissToast} anchor="right" />
                )}
                {menuOpenId === d.id && (
                  <>
                    <div className="row-menu-backdrop" onClick={() => setMenuOpenId(null)} aria-hidden />
                    <div className="row-menu" role="menu">
                      <button role="menuitem" onClick={() => { setMenuOpenId(null); startEdit(d); }}>
                        <EditIcon size={16} /> {t('home.edit')}
                      </button>
                      {/* Only a RATED dish can be published — a post asserts a
                          verdict, and an unrated dish has none to assert. */}
                      {d.my_score !== null && (
                        <button role="menuitem" onClick={() => { setMenuOpenId(null); setPosting(d); }}>
                          <GlobeIcon size={16} /> {d.posted ? t('post.public') : t('post.publish')}
                        </button>
                      )}
                      {/* Share: simplified (owner call) — no consent card, no
                          comment prompt. Straight to the OS share sheet;
                          shareDish silently upgrades an unposted dish to a
                          link-only post first. */}
                      {d.my_score !== null && (
                        <button role="menuitem" onClick={() => { setMenuOpenId(null); shareDish(d); }}>
                          <ShareIcon size={16} /> {t('post.share.cta')}
                        </button>
                      )}
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
      {/* No list-level Toast: it lives on the shared ROW now (see .dish-actions).
          Leaving one here too would render two pills for one share. */}
    </>
  );
}
