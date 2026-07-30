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
  stampsFromPicks, pickMatchesItem, mergeStamps, applyStampEvent,
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
  /** item.key currently saving — screens use it to ignore a double-tap. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Realtime overlay: pending pick/unpick events the poll hasn't confirmed yet.
  // See tableStamps.ts for the full architecture note (it is bidirectional — an
  // 'unpick' entry HIDES a stamp the poll still has, which is what makes your own
  // unpick feel instant).
  const [realtimeStamps, setRealtimeStamps] = useState<Record<string, StampOverlay>>({});
  // Bridges the one gap stamps alone can't: which dish ROW to DELETE if I un-pick
  // before the next poll has caught up with a pick I *just* made.
  const [pendingDishIds, setPendingDishIds] = useState<Record<string, string>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Keys with a write still in flight. The poll clears the overlay when it lands
  // (it's authoritative), but an OPTIMISTIC stamp is applied before its insert has
  // committed — so a poll landing mid-flight would clear a stamp the poll cannot
  // possibly know about yet and the chop would blink out and back. These keys are
  // held back from that clear until their request settles.
  const inFlightRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/table/${code}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setState(json);
      setError('');
      // The poll is authoritative the moment it lands, so a stale overlay entry
      // (e.g. an unpick broadcast this client missed) can never outlive DB truth
      // by more than one cycle — except for writes still in flight, see above.
      const keep = inFlightRef.current;
      setRealtimeStamps(prev => {
        if (keep.size === 0) return {};
        return Object.fromEntries(Object.entries(prev).filter(([k]) => keep.has(k)));
      });
      setPendingDishIds(prev => {
        if (keep.size === 0) return {};
        return Object.fromEntries(Object.entries(prev).filter(([k]) => keep.has(k)));
      });
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
    inFlightRef.current.add(item.key);
    setBusyKey(item.key);
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
        setPendingDishIds(prev => ({ ...prev, [item.key]: dishId }));
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
      inFlightRef.current.delete(item.key);
      setBusyKey(null);
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
    const dishId = mine?.id ?? pendingDishIds[item.key];
    if (!dishId) return;
    const event: StampEvent = { type: 'unpick', user_id: s.you, name: myName(s) };
    inFlightRef.current.add(item.key);
    setBusyKey(item.key);
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
      inFlightRef.current.delete(item.key);
      setBusyKey(null);
    }
  };

  /** Toggle — "picked" is always derived from whether MY stamp is present, never a
   * separate local flag that could disagree with the chop everyone sees. */
  const toggle = (item: StampableItem, extras?: Parameters<typeof pick>[1]) => {
    if (busyKey) return; // ignore a second tap while the first is in flight
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

  return {
    state, error, refresh,
    members: state?.members ?? [],
    picks: state?.table_picks ?? [],
    you: state?.you ?? null,
    busyKey, pick, unpick, toggle, stampsFor, isPicked, colorFor,
  };
}
