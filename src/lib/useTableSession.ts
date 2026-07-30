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

export type Member = {
  user_id: string; handle: string; display_name: string | null;
  username_claimed: boolean; has_profile: boolean; rating_count: number;
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
};

/** The minimum an item needs for stamps to find its picks — so a /scan
 * ScannedItem and a /table RankedItem both qualify without either screen
 * converting to the other's shape. */
export type StampableItem = { key: string; name: string; name_zh?: string | null };

export function useTableSession(code: string | null) {
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState('');
  /** Keys currently saving — a set, not one key, so tapping dish B never has to wait
   * on dish A. A single global busy key silently DROPPED taps while any other write
   * was in flight, which is precisely what ordering for a table looks like: several
   * dishes tapped in a couple of seconds. Guarding is done off busyRef (synchronous,
   * so a genuine double-tap in one tick is caught); this state exists for rendering. */
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const busyRef = useRef<Set<string>>(new Set());
  const markBusy = (key: string, busy: boolean) => {
    if (busy) busyRef.current.add(key); else busyRef.current.delete(key);
    setBusyKeys(new Set(busyRef.current));
  };
  // Realtime overlay: pending pick/unpick events the poll hasn't confirmed yet.
  // See tableStamps.ts for the full architecture note (it is bidirectional — an
  // 'unpick' entry HIDES a stamp the poll still has, which is what makes your own
  // unpick feel instant).
  const [realtimeStamps, setRealtimeStamps] = useState<Record<string, StampOverlay>>({});
  // Bridges the one gap stamps alone can't: which dish ROW to DELETE if I un-pick
  // before the next poll has caught up with a pick I *just* made.
  // Carries the time it was recorded, for the same reason the overlay does — a poll
  // may only forget a pending id it was actually in a position to have seen.
  const [pendingDishIds, setPendingDishIds] = useState<Record<string, { id: string; at: number }>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);

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
      setState(json);
      setError('');
      // A stale overlay entry (e.g. an unpick broadcast this client missed) still
      // can't outlive DB truth by more than one cycle: the next poll is issued after
      // it and prunes it.
      setRealtimeStamps(prev => pruneOverlaysBefore(prev, requestedAt));
      setPendingDishIds(prev =>
        Object.fromEntries(Object.entries(prev).filter(([, v]) => v.at >= requestedAt)));
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
        setPendingDishIds(prev => ({ ...prev, [item.key]: { id: dishId, at: Date.now() } }));
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
    const dishId = mine?.id ?? pendingDishIds[item.key]?.id;
    if (!dishId) return;
    const event: StampEvent = { type: 'unpick', user_id: s.you, name: myName(s) };
    markBusy(item.key, true);
    applyLocalStampEvent(item.key, event);
    broadcastStamp(item.key, event);
    try {
      const res = await fetch('/api/my/dishes', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dishId }),
      });
      if (res.ok) {
        setPendingDishIds(prev => { const { [item.key]: _drop, ...rest } = prev; return rest; });
      } else {
        const undo: StampEvent = { type: 'pick', user_id: s.you, name: myName(s) };
        applyLocalStampEvent(item.key, undo);
        broadcastStamp(item.key, undo);
      }
    } catch {
      const undo: StampEvent = { type: 'pick', user_id: s.you, name: myName(s) };
      applyLocalStampEvent(item.key, undo);
      broadcastStamp(item.key, undo);
    } finally {
      markBusy(item.key, false);
    }
  };

  /** Toggle — "picked" is always derived from whether MY stamp is present, never a
   * separate local flag that could disagree with the chop everyone sees. */
  const toggle = (item: StampableItem, extras?: Parameters<typeof pick>[1]) => {
    // Only THIS dish's own write blocks it — see busyKeys.
    if (busyRef.current.has(item.key)) return;
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

  return {
    state, error, refresh, setRestaurant,
    restaurant: state?.restaurant ?? null,
    members: state?.members ?? [],
    picks: state?.table_picks ?? [],
    you: state?.you ?? null,
    busyKeys, pick, unpick, toggle, stampsFor, isPicked, colorFor,
  };
}
