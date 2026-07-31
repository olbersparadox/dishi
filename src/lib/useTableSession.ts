// THE table-session engine. One implementation of polling, realtime, stamps, and
// pick/unpick, mounted by every screen that shows a shared table.
//
// Why this exists: /scan grew its OWN version of all of this as "a lightweight
// glance" at a shared session, and the two drifted exactly as far as you'd
// expect. A two-account field test (2026-07-30) found, all at once: the scanner's
// picks were never written to the server at all (scan's togglePick only mutated a
// local Set until a 3-step confirm sheet), the scanner had no realtime channel so
// everything arrived up to 5s late, and the scanner saw picker handles as a text
// line where /table showed chop stamps. Three symptoms, one cause — a lookalike
// standing in for the real thing. Per CLAUDE.md's "reuse, don't imitate", the fix
// is that there is now only one of these and both screens mount it.
//
// Architecture (inherited from tableStamps.ts, unchanged): the 5s poll is the
// SOURCE OF TRUTH; realtime broadcasts are a pure latency layer over it. Any
// client that misses a broadcast self-heals on the next poll.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { chopColorMap, chopColorFor } from '@/lib/chop';
import {
  stampsFromPicks, pickMatchesItem, mergeStamps, applyStampEvent, pruneOverlaysBefore,
  type Stamp, type StampOverlay, type StampEvent,
} from '@/lib/tableStamps';
import { readyCount as countReady, drawPayer } from '@/lib/tableSettle';
import type { DiceGameView } from '@/lib/tableDice';
import type { Die, Direction } from '@/lib/liarsDice';

export type Member = {
  user_id: string; handle: string; display_name: string | null;
  username_claimed: boolean; has_profile: boolean; rating_count: number;
  /** When this member tapped "done picking". Null until they do. */
  ready_at: string | null;
};
export type RankedItem = {
  key: string; name: string; name_zh?: string | null; name_original?: string; price?: string | null;
  cuisine: string | null; photo_url?: string | null;
  // Stage-2 enrichment's day-0 utility fields — present when this candidate came
  // from a real /scan share; absent (and simply not rendered) for a restaurant's
  // own typed menu or the community-dish pool, neither of which ever carries them.
  diet?: string[] | null; cooking_method?: string | null; heaviness?: string | null;
  ingredients?: string[] | null; enriched?: boolean;
  group_match: number; member_matches: { handle: string; match: number }[];
  unanimous: boolean; protected_by_fairness: boolean;
  attributes?: Record<string, number>;
};
export type TablePick = {
  id: string; user_id: string; name: string; name_zh: string | null;
  handle: string; display_name: string | null;
  identity_name?: string | null; identity_name_zh?: string | null;
  table_item_key?: string | null;
};
export type SessionState = {
  code: string; session_id: string; restaurant_id: string | null;
  /** The session's restaurant by name, for the table bar's restaurant line. Null
   * when create-time resolution wasn't confident enough to guess (see
   * tableRestaurant.ts) — a blank the line fills in one tap. */
  restaurant: { id: string; name: string; name_zh: string | null } | null;
  status: string; is_host: boolean; has_menu: boolean; orderable: boolean;
  you: string; members: Member[]; items: RankedItem[]; table_picks: TablePick[];
  /** Stamped once every member has tapped done. Sticky — see the GET route. */
  settled_at: string | null;
  pay_method: 'equal' | 'random' | 'game' | null;
  pay_payer_id: string | null;
  /** 大話骰, as this member is allowed to see it: their own five dice, the public
   *  bidding, and — only after 開 — every cup. Null until a table starts a game.
   *  Shaped server-side by viewForUser; the client never filters dice itself. */
  game: DiceGameView | null;
};

/** The minimum an item needs for stamps to find its picks — so a /scan
 * ScannedItem and a /table RankedItem both qualify without either screen
 * converting to the other's shape. */
export type StampableItem = { key: string; name: string; name_zh?: string | null };

/** In-flight keys for the two SESSION-level writes. Not dish keys — they share
 *  inFlightRef with picks, so they are prefixed to stay out of that namespace. */
const PAY_KEY = '__pay';
const DICE_KEY = '__dice';

export function useTableSession(code: string | null) {
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState('');
  /** My own "done picking" tap before the poll has confirmed it. Null means "no
   * claim of my own" — the server's answer, whatever it is. */
  const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);
  /** Keys currently saving — a set, not one key, so tapping dish B never has to wait
   * on dish A. A single global busy key silently DROPPED taps while any other write
   * was in flight, which is precisely what ordering for a table looks like: several
   * dishes tapped in a couple of seconds. Guarding is done off busyRef (synchronous,
   * so a genuine double-tap in one tick is caught); this state exists for rendering. */
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const busyRef = useRef<Set<string>>(new Set());
  // Two SEPARATE concerns that used to be one flag:
  //  - inFlight protects the overlay from a poll that raced this write (see
  //    pruneOverlaysBefore). Every write needs it, for as long as it runs.
  //  - busy blocks a second tap on the same dish. Only writes we actually want to
  //    serialise need it, and un-picking deliberately does NOT (its endpoint is slow
  //    enough that blocking on it is the latency the owner reported).
  const markInFlight = (key: string, active: boolean) => {
    if (active) inFlightRef.current.add(key); else inFlightRef.current.delete(key);
  };
  const markBusy = (key: string, busy: boolean) => {
    markInFlight(key, busy);
    if (busy) busyRef.current.add(key); else busyRef.current.delete(key);
    setBusyKeys(new Set(busyRef.current));
  };
  // Realtime overlay: pending pick/unpick events the poll hasn't confirmed yet.
  // See tableStamps.ts for the full architecture note (it is bidirectional — an
  // 'unpick' entry HIDES a stamp the poll still has, which is what makes your own
  // unpick feel instant).
  const [realtimeStamps, setRealtimeStamps] = useState<Record<string, StampOverlay>>({});
  // Bridges the one gap stamps alone can't: which dish ROW to DELETE if I un-pick
  // before the next poll has caught up with a pick I *just* made. Carries the time
  // it was recorded, for the same reason the overlay does — a poll may only forget a
  // pending id it was actually in a position to have seen.
  //
  // A ref, not state: nothing renders it, and an unpick queued behind a pick has to
  // read the id that pick just produced. Through useState it would have read the
  // render-stale copy, found nothing, and silently done nothing.
  const pendingDishIds = useRef<Record<string, { id: string; at: number }>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Keys with a write in flight. Both the poll (which must not clear an optimistic
  // entry whose write hasn't committed) and toggle (which queues rather than drops)
  // read this.
  const inFlightRef = useRef<Set<string>>(new Set());
  // The state the user last ASKED for on a key whose write was still going, so a tap
  // during a round trip is honoured when that round trip ends instead of vanishing.
  const desiredRef = useRef<Map<string, boolean>>(new Map());
  const unpickRef = useRef<((item: StampableItem) => void) | null>(null);

  const refresh = useCallback(async () => {
    if (!code) return;
    // Stamped BEFORE the request goes out, because that is the instant the response
    // describes. Clearing anything newer than this would discard an event the server
    // hadn't been asked about yet — see pruneOverlaysBefore for the live symptom.
    const requestedAt = Date.now();
    try {
      const res = await fetch(`/api/table/${code}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // A poll that raced a local write must not hand back the pre-write value.
      // The overlay has always been protected this way (see pruneOverlaysBefore);
      // the settle fields were not, and it showed the moment 隨機一人 grew an
      // animation — a poll landing mid-spin reverted pay_payer_id for one cycle,
      // which cancelled the spin, and the next poll restored it and started a
      // second one. A spin that visibly restarts mid-flight (owner, 2026-07-31).
      setState(prev => {
        if (!prev) return json;
        const held: Partial<SessionState> = {};
        if (inFlightRef.current.has(PAY_KEY)) {
          held.pay_method = prev.pay_method;
          held.pay_payer_id = prev.pay_payer_id;
        }
        // Same hazard, same shape: a poll issued before a move can answer after
        // it, and would put the round back as it stood before the move landed.
        if (inFlightRef.current.has(DICE_KEY)) held.game = prev.game;
        return Object.keys(held).length ? { ...json, ...held } : json;
      });
      setError('');
      // A stale overlay entry (e.g. an unpick broadcast this client missed) still
      // can't outlive DB truth by more than one cycle: the next poll is issued after
      // it and prunes it.
      setRealtimeStamps(prev => pruneOverlaysBefore(prev, requestedAt, inFlightRef.current));
      pendingDishIds.current = Object.fromEntries(
        Object.entries(pendingDishIds.current)
          .filter(([k, v]) => v.at >= requestedAt || inFlightRef.current.has(k)));
    } catch (e: any) {
      setError(e.message || 'Lost the table.');
    }
  }, [code]);

  // Poll every 5s while open, so rankings shift live as people join.
  useEffect(() => {
    if (!code) return;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [code, refresh]);

  // One channel per session, subscribed once session_id is known (it arrives async
  // with the first refresh). `self: false` because a local action is already
  // applied instantly below — receiving our own broadcast back would be a
  // pointless round trip (harmless: applyStampEvent is idempotent).
  const sessionId = state?.session_id ?? null;
  useEffect(() => {
    if (!sessionId) return;
    const supabase = supabaseBrowser();
    const channel = supabase.channel(`table:${sessionId}`, { config: { broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'pick' }, ({ payload }) => {
        applyLocalStampEvent(payload.item_key, { type: 'pick', user_id: payload.user_id, name: payload.name });
      })
      .on('broadcast', { event: 'unpick' }, ({ payload }) => {
        applyLocalStampEvent(payload.item_key, { type: 'unpick', user_id: payload.user_id, name: payload.name });
      })
      // Readiness carries no overlay of its own — the broadcast just pulls the
      // poll forward. Waiting up to 5s to learn the last person tapped is the one
      // place in this flow where the delay is actually felt: everyone is sitting
      // there looking at the screen waiting for exactly this.
      .on('broadcast', { event: 'ready' }, () => { refresh(); })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // One shared reducer call for a stamp event whether it came from the network or
  // from MY OWN action — never two nearly-identical code paths that could drift.
  function applyLocalStampEvent(itemKey: string, event: StampEvent) {
    setRealtimeStamps(prev => ({ ...prev, [itemKey]: applyStampEvent(prev[itemKey] ?? {}, event) }));
  }
  function broadcastStamp(itemKey: string, event: StampEvent) {
    channelRef.current?.send({
      type: 'broadcast', event: event.type,
      payload: { item_key: itemKey, user_id: event.user_id, name: event.name },
    });
  }

  /** Own name for the chop a broadcast carries — the SAME fallback chain rendered
   * everywhere else (display_name, then the auto-handle). */
  const myName = (s: SessionState) => {
    const me = s.members.find(m => m.user_id === s.you);
    return me?.display_name ?? me?.handle ?? 'someone';
  };

  /**
   * Pick, optimistically. The stamp lands (locally AND on every other screen)
   * before the round trip finishes, and is rolled back if the write actually
   * fails — because a pick is a tap on a dish and has to feel like one. Awaiting
   * the response first is what made picking "slow" in the field test: the endpoint
   * writes a dish row, then companion edges, and the chop appeared only after all
   * of it. Rollback broadcasts too, so nobody is left holding a stamp for a pick
   * that never committed; a missed rollback still self-heals on the next poll.
   */
  const pick = async (item: StampableItem, opts?: { attributes?: Record<string, number>; cuisine?: string | null;
    cooking_method?: string | null; heaviness?: string | null; diet?: string[] | null; ingredients?: string[] | null }) => {
    const s = state;
    if (!s) return;
    const event: StampEvent = { type: 'pick', user_id: s.you, name: myName(s) };
    markBusy(item.key, true);
    applyLocalStampEvent(item.key, event);
    broadcastStamp(item.key, event);
    try {
      const res = await fetch('/api/dishes/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // restaurant_id deliberately NOT sent: /api/dishes/pick reads the
          // session's own restaurant server-side and it wins regardless, so one
          // table can never produce differently-attributed rows.
          table_session_id: s.session_id,
          items: [{
            name: item.name, name_zh: item.name_zh, table_item_key: item.key,
            cuisine: opts?.cuisine ?? null, attributes: opts?.attributes ?? {},
            cooking_method: opts?.cooking_method, heaviness: opts?.heaviness,
            diet: opts?.diet, ingredients: opts?.ingredients,
          }],
        }),
      });
      const json = await res.json().catch(() => null);
      const dishId = json?.picked?.[0]?.id as string | undefined;
      if (res.ok && dishId) {
        pendingDishIds.current = { ...pendingDishIds.current, [item.key]: { id: dishId, at: Date.now() } };
        // Seal at PICK time — the moment you commit to ordering a dish, the engine
        // commits its prediction, rather than waiting until you next open the Taste
        // tab. A picked dish already carries real attributes from the scan, so the
        // seal is meaningful now. Server-gated (>= SEAL_GATE ratings) and
        // idempotent, so this no-ops when the engine is too young or a seal already
        // exists. NOT awaited: the stamp is cosmetic to this interaction and the
        // Taste-tab queue load re-seals as a backstop; blocking the tap on it is
        // what this whole change is undoing. This used to live in scan's
        // confirmPicks, which no longer exists — it belongs with the pick itself,
        // so /table picks get sealed too (they never were before).
        fetch('/api/seals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish_id: dishId }),
        }).catch(() => { /* a missing stamp is cosmetic; never surface it */ });
      } else {
        const undo: StampEvent = { type: 'unpick', user_id: s.you, name: myName(s) };
        applyLocalStampEvent(item.key, undo);
        broadcastStamp(item.key, undo);
      }
    } catch {
      const undo: StampEvent = { type: 'unpick', user_id: s.you, name: myName(s) };
      applyLocalStampEvent(item.key, undo);
      broadcastStamp(item.key, undo);
    } finally {
      markBusy(item.key, false);
      // Tapped again while this was in flight? They wanted it OFF.
      if (desiredRef.current.get(item.key) === false) {
        desiredRef.current.delete(item.key);
        unpickRef.current?.(item);
      } else desiredRef.current.delete(item.key);
    }
  };

  /**
   * Un-pick: DELETEs the dish row the pick created, via the same owning-user-scoped
   * endpoint the rating queue's own trash icon uses — no second deletion path.
   * Finds MY OWN pick with the same pickMatchesItem rule stamps use, falling back
   * to pendingDishIds only for the window right after a pick the poll hasn't seen.
   */
  const unpick = async (item: StampableItem) => {
    const s = state;
    if (!s) return;
    const mine = s.table_picks.find(p => p.user_id === s.you && pickMatchesItem(p, item));
    const dishId = mine?.id ?? pendingDishIds.current[item.key]?.id;
    if (!dishId) return;
    const event: StampEvent = { type: 'unpick', user_id: s.you, name: myName(s) };
    applyLocalStampEvent(item.key, event);
    broadcastStamp(item.key, event);
    // Deliberately NOT awaited, and no busy flag. DELETE /api/my/dishes is the
    // rating queue's own trash endpoint: it checks the dish lock, counts ratings,
    // detaches points_ledger, deletes, and may replay the taste profile — four-plus
    // sequential round trips, entirely appropriate for deleting a RATED dish from
    // the journal and far too slow to hold a chop on screen behind (owner,
    // 2026-07-30: "needs to wait if you want to unpick it"). The screen is already
    // correct the instant it's tapped; all this has to do is land, or undo itself.
    const { [item.key]: _drop, ...rest } = pendingDishIds.current;
    pendingDishIds.current = rest;
    // Not busy (taps stay live), but very much in flight: without this a poll
    // issued before the DELETE commits would prune the unpick and the chop would
    // come straight back — the 2026-07-30 reappearing-chop bug, exactly.
    markInFlight(item.key, true);
    fetch('/api/my/dishes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: dishId }),
    })
      .then(res => { if (!res.ok) throw new Error('unpick rejected'); })
      .catch(() => {
        markInFlight(item.key, false);
        // Put it back — including on everyone else's screen, so nobody is left
        // missing a stamp for a pick that is still in the database. A missed undo
        // still self-heals on the next poll.
        const undo: StampEvent = { type: 'pick', user_id: s.you, name: myName(s) };
        applyLocalStampEvent(item.key, undo);
        broadcastStamp(item.key, undo);
        pendingDishIds.current = { ...pendingDishIds.current, [item.key]: { id: dishId, at: Date.now() } };
      })
      .finally(() => markInFlight(item.key, false));
  };
  unpickRef.current = unpick;

  /** Toggle — "picked" is always derived from whether MY stamp is present, never a
   * separate local flag that could disagree with the chop everyone sees. */
  const toggle = (item: StampableItem, extras?: Parameters<typeof pick>[1]) => {
    const s = state;
    if (!s) return;
    // Only THIS dish's own write blocks it — see busyKeys. And it QUEUES rather than
    // drops: un-picking within the pick's own round trip used to do nothing at all,
    // so the dish stayed picked and you had to wait and tap again (owner, 2026-07-30:
    // "picking a dish is quick, but needs to wait if you want to unpick it").
    if (busyRef.current.has(item.key)) {
      // The WRITE has to wait (an unpick can't run before the pick returns the dish
      // id it deletes) — the VISUAL must not. Queueing without flipping the stamp
      // left the chop up until the pick's round trip settled, which read as unpick
      // lag even after the unpick itself stopped blocking (owner, 2026-07-30:
      // "still a bit lag"). Flip it now, everywhere; the queued write catches up.
      const want = !isPicked(item);
      const ev: StampEvent = { type: want ? 'pick' : 'unpick', user_id: s.you, name: myName(s) };
      applyLocalStampEvent(item.key, ev);
      broadcastStamp(item.key, ev);
      desiredRef.current.set(item.key, want);
      return;
    }
    if (isPicked(item)) unpick(item); else pick(item, extras);
  };

  /** Poll-derived base merged with the realtime overlay, for any item shape. */
  const stampsFor = (item: StampableItem): Stamp[] =>
    mergeStamps(stampsFromPicks(item, state?.table_picks ?? []), realtimeStamps[item.key] ?? {});

  const isPicked = (item: StampableItem) =>
    !!state && stampsFor(item).some(s => s.user_id === state.you);

  // ONE color assignment for the whole session, from the member set alone — so it
  // is identical on every member's screen. chopColorFor is only the fallback for a
  // realtime stamp racing the members poll.
  const colorById = chopColorMap((state?.members ?? []).map(m => m.user_id));
  const colorFor = (userId: string) => colorById.get(userId) ?? chopColorFor(userId);

  /** Set or correct which restaurant this table is at. The server re-attributes
   * the picks already made (see PATCH /api/table/[code]) — a correction that left
   * existing rows wrong would be a worse trap than the blank it replaced. Refreshed
   * after, so the line shows the resolved name rather than the raw choice. */
  const setRestaurant = async (choice: unknown) => {
    if (!code) return;
    await fetch(`/api/table/${code}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant: choice }),
    });
    await refresh();
  };

  /**
   * "I'm done picking", and the way back out of it.
   *
   * Optimistic like a pick is, and for the same reason: the tap's whole visible
   * effect is the waiting layer appearing, so waiting on the round trip to show
   * it would make the one moment the table is watching feel broken. Rolled back
   * if the write fails; the poll is still the source of truth either way.
   */
  const setReady = async (ready: boolean) => {
    if (!code) return;
    setOptimisticReady(ready);
    try {
      const res = await fetch(`/api/table/${code}/ready`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ready }),
      });
      if (!res.ok) { setOptimisticReady(null); return; }
      // Tell the others before refreshing ourselves — they are the ones whose
      // screen is blocked on this tap.
      channelRef.current?.send({ type: 'broadcast', event: 'ready', payload: { ready } });
      await refresh();
    } catch {
      setOptimisticReady(null);
    }
  };

  /**
   * How the bill gets carried, applied the instant it is tapped.
   *
   * Optimistic, and — unlike a pick — WITHOUT guessing: drawPayer is deterministic
   * on the session id, which is the same property /pay's own comment leans on, so
   * the answer computed here is the answer the server is about to write, not a
   * hopeful stand-in for it. The stickiness rule is mirrored for the same reason
   * (an existing payer is kept, never re-rolled), because a client that re-drew
   * would flash a different name for one round trip and let the table shop for an
   * answer it liked. An equal split needs no draw at all — the screen computes the
   * per-head figure from the total it is already showing.
   *
   * Two serialised round trips used to run before ANY of this appeared: the POST,
   * then a full session refresh. The owner reported it as ~2s of dead air on every
   * tap (2026-07-31). The POST already answers with pay_method and pay_payer_id,
   * so the refresh was re-fetching the whole table to learn what the response had
   * just said — the response is applied directly instead, and the poll remains the
   * backstop it always was.
   */
  const choosePayMethod = async (method: 'equal' | 'random') => {
    if (!code) return;
    const prev = state;
    if (!prev) return;
    const optimisticPayer = method === 'random'
      ? (prev.pay_payer_id ?? drawPayer(prev.members.map(m => m.user_id), prev.session_id))
      : null;
    setState(s => (s ? { ...s, pay_method: method, pay_payer_id: optimisticPayer } : s));
    markInFlight(PAY_KEY, true);
    try {
      const res = await fetch(`/api/table/${code}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // Back to what the server last told us, not to null: a failed switch must
        // leave the previous decision standing rather than blanking the screen.
        setState(s => (s ? { ...s, pay_method: prev.pay_method, pay_payer_id: prev.pay_payer_id } : s));
        setError(json?.error || 'That choice did not land.');
        return;
      }
      setState(s => (s ? { ...s, pay_method: json.pay_method, pay_payer_id: json.pay_payer_id } : s));
      channelRef.current?.send({ type: 'broadcast', event: 'ready', payload: { pay: method } });
    } catch {
      setState(s => (s ? { ...s, pay_method: prev.pay_method, pay_payer_id: prev.pay_payer_id } : s));
      setError('That choice did not land.');
    } finally {
      markInFlight(PAY_KEY, false);
    }
  };

  /**
   * 大話骰. Every move is one POST to the same endpoint, which answers with THIS
   * player's view of the round as it now stands — so the mover's own screen
   * updates from the server's answer rather than from a guess about it, and the
   * others are nudged onto the poll that already carries the game.
   *
   * Deliberately not optimistic, unlike a pick. A pick is a tap on a dish and has
   * to feel like one; a call is a claim in a game with money on it, and showing
   * it as made before the server accepted it is how a table ends up arguing about
   * a bid that was never legal. The round trip is one request and the poll is the
   * backstop either way.
   */
  const playDice = async (payload: Record<string, unknown>) => {
    if (!code) return;
    markInFlight(DICE_KEY, true);
    try {
      const res = await fetch(`/api/table/${code}/dice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.error || 'That move did not land.'); return; }
      // The response is this player's own view — safe to apply directly, and it
      // is what makes your own call appear the instant it is accepted.
      if (json?.game) setState(prev => (prev ? { ...prev, game: json.game, pay_method: 'game' } : prev));
      // Same trick readiness uses: the broadcast carries no state, it just pulls
      // everyone else's poll forward. Waiting up to 5s to learn the turn has
      // reached you is precisely the delay this game cannot afford.
      channelRef.current?.send({ type: 'broadcast', event: 'ready', payload: { dice: true } });
      // Deliberately NOT followed by a refresh: the response above already carried
      // this player's whole view, so awaiting a second full session fetch only
      // delayed the move landing on the screen that made it (owner, 2026-07-31).
      // The 5s poll still reconciles anything the response didn't cover.
    } catch {
      setError('That move did not land.');
    } finally {
      markInFlight(DICE_KEY, false);
    }
  };
  /**
   * 搖骰 — open the round, and switch the bill's method to the game with it.
   *
   * The method flips to 'game' before the POST so the tap registers immediately;
   * the dice themselves cannot be optimistic and must not be faked — they are
   * generated server-side and returned to their owner alone (the seal contract
   * applied to a bill), so the cups appear when the server answers. Until then
   * this is an honest intermediate state: the choice is visibly made, the round
   * has not started.
   */
  const startDiceGame = () => {
    setState(s => (s ? { ...s, pay_method: 'game' } : s));
    return playDice({ action: 'roll' });
  };
  /** 向左 / 向右, the opener's one extra decision. */
  const pickDirection = (direction: Direction) => playDice({ action: 'direction', direction });
  /** A call: this many of that face, across every cup on the table. */
  const callBid = (quantity: number, face: Die) => playDice({ action: 'bid', quantity, face });
  /** 開 — every cup lifts and somebody is holding the bill. */
  const openCups = () => playDice({ action: 'challenge' });

  const members = state?.members ?? [];
  // Server truth wins the moment it agrees with the optimistic flag, which is
  // what retires it — never a timer.
  const serverReady = !!members.find(m => m.user_id === state?.you)?.ready_at;
  const iAmReady = optimisticReady === null || optimisticReady === serverReady
    ? serverReady : optimisticReady;

  return {
    state, error, refresh, setRestaurant,
    restaurant: state?.restaurant ?? null,
    members,
    picks: state?.table_picks ?? [],
    you: state?.you ?? null,
    busyKeys, pick, unpick, toggle, stampsFor, isPicked, colorFor,
    // The settle handshake. `settled` is read off the session rather than
    // recomputed from members here, so it inherits the server's stickiness: a
    // late joiner makes allMembersReady false again, and the table must NOT fall
    // back out of the bill it is already looking at.
    setReady, choosePayMethod, iAmReady,
    readyCount: countReady(members),
    settled: !!state?.settled_at,
    payMethod: state?.pay_method ?? null,
    payerId: state?.pay_payer_id ?? null,
    game: state?.game ?? null,
    startDiceGame, pickDirection, callBid, openCups,
  };
}
