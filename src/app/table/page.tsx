'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import Chop from '@/components/Chop';
import { chopColor } from '@/lib/chop';
import DishListRow from '@/components/DishListRow';
import TableBar from '@/components/TableBar';
import { LeaveIcon } from '@/components/icons';
import { useLang } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { normalizePhoto } from '@/lib/image';
import { mapWithConcurrency } from '@/lib/concurrency';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { stampsFromPicks, pickMatchesItem, mergeStamps, applyStampEvent, type StampOverlay, type StampEvent } from '@/lib/tableStamps';

// A page a joined member scans and pushes straight onto the shared menu —
// deliberately a SUBSET of scan/page.tsx's own ScannedItem: this screen never
// renders per-item scan progress (the poll-refreshed ranked list below is the
// only view of it), so it only needs enough shape to survive the enrich/score
// round trip and the PATCH body. Never a second scan UI — see the comment on
// addPage below for why scan/page.tsx's own onPick isn't reused directly.
type ScanPageItem = {
  name: string; name_zh?: string | null; name_original: string; price: string | null;
  cuisine: string; hook: string;
  diet: string[]; cooking_method: string | null; heaviness: string | null; ingredients: string[];
  attributes?: Record<string, number>;
};
const SCORE_CONCURRENCY = 6; // matches scan/page.tsx's own cap for the same two per-dish endpoints

type Member = { user_id: string; handle: string; display_name: string | null; has_profile: boolean; rating_count: number };
type RankedItem = {
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
type TablePick = {
  id: string; user_id: string; name: string; name_zh: string | null;
  handle: string; display_name: string | null;
  identity_name?: string | null; identity_name_zh?: string | null;
  table_item_key?: string | null;
};
type SessionState = {
  code: string; session_id: string; restaurant_id: string | null;
  status: string; is_host: boolean; has_menu: boolean; orderable: boolean;
  you: string; members: Member[]; items: RankedItem[]; table_picks: TablePick[];
};

// "Never nag" (backlog, item 2): a skipped chop-name prompt must not reappear every
// visit. There's no server-side "dismissed" state — the fallback (handle) is a fully
// valid permanent choice — so a device-local flag is the right amount of memory:
// enough to honor a skip, with no server round-trip or schema for a UI-only choice.
const CHOP_PROMPT_DISMISSED_KEY = 'dishi_chop_prompt_dismissed';

export default function TablePage() {
  return (
    <AuthGate>
      <Table />
    </AuthGate>
  );
}

// No standalone landing screen anymore (owner call, 2026-07-21): it only ever
// duplicated the join-by-code box scan/page.tsx already has front and center,
// and its one non-duplicate capability (starting a table with no menu / a raw
// unenriched photo) wasn't worth the second UI. Starting or joining a table
// now only ever happens from /scan; this route is just the shared session
// view for a code, reached via ?code= from a scan's invite link or its join box.
function Table() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('code');
    if (p) setCode(p.toUpperCase());
    else router.replace('/scan');
  }, [router]);

  if (!code) return null; // redirecting to /scan
  return <Session code={code} onLeave={() => router.push('/scan')} />;
}

// ---------------------------------------------------------------- session ----
// ONE surface for host and joiner alike (item 1 of the Table Mode social batch,
// 2026-07-21): both used to render different component trees — the host saw the
// redesigned 你的最佳選擇 list (via /scan's tableSession bar), a joiner landed here
// and got the PRE-redesign layout (conic-gradient score rings, per-member percentage
// bars). That's now gone. This renders the SAME numbered-row visual grammar as scan's
// settled list (scan-item/scan-rank/dish-row, DishName, price, DishInfoDisplay-style
// chips) for every member, with only two per-person differences: the group_match
// ranking BLEND (unchanged math — see rankForGroup/group.ts, presentation only
// unifies here) and "your own picks" highlighted (derived from whose stamp is on
// the dish, see Session's render — never a separate local flag). The percentage-bar
// breakdown (查看全桌的意見) is retired along with the rings — it displayed exact
// numbers scan's OWN settled-list philosophy deliberately avoids (see the "no
// displayed numbers, only an earned mark" comment in scan/page.tsx); 全檯啱 is that
// earned mark's table-mode equivalent, rendered with the same 🔥 tag scan uses.
function Session({ code, onLeave }: { code: string; onLeave: () => void }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState<string | null>(null); // item.key currently saving
  // "Picked" is no longer its own local flag (owner correction, 2026-07-21): a dish
  // is picked iff MY OWN stamp is present, derived straight from the same stamps
  // list everyone else's chops come from — a Set that only updated on click used to
  // drift from server truth on reload (a dish you'd already picked would render
  // un-filled, though its stamp still showed correctly), which is exactly the
  // inconsistency this closes. See stamps/picked in the render below.
  //
  // Realtime pick stamps (item 3): a LATENCY overlay on top of the poll's own
  // table_picks (see tableStamps.ts for the full architecture note — the overlay
  // is bidirectional, an 'unpick' entry hides a stamp the poll still has, not just
  // 'pick' adding one). Cleared after every successful poll, since the poll is
  // authoritative once it lands.
  const [realtimeStamps, setRealtimeStamps] = useState<Record<string, StampOverlay>>({});
  // Bridges the SAME gap realtimeStamps bridges, for the one thing stamps alone
  // can't answer: which dish ROW to DELETE if I un-pick before the next poll has
  // caught up with a pick I *just* made. Cleared alongside realtimeStamps on every
  // poll, once state.table_picks itself carries the real id.
  const [pendingDishIds, setPendingDishIds] = useState<Record<string, string>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Add a page (Table Mode item 6, 2026-07-22): any member can grow the
  // shared menu now, not just the host who started it — someone else at the
  // table is often the one holding page 3, or the drinks list.
  const [appending, setAppending] = useState(false);
  const [appendError, setAppendError] = useState('');
  const [chopName, setChopName] = useState('');
  const [chopSaving, setChopSaving] = useState(false);
  const [chopDismissed, setChopDismissed] = useState(true); // true (hidden) until checked, so the prompt never flashes on
  useEffect(() => {
    setChopDismissed(typeof window !== 'undefined' && localStorage.getItem(CHOP_PROMPT_DISMISSED_KEY) === '1');
  }, []);
  const dismissChopPrompt = () => {
    if (typeof window !== 'undefined') localStorage.setItem(CHOP_PROMPT_DISMISSED_KEY, '1');
    setChopDismissed(true);
  };
  // 名印 one-time setup: type a display name, done — persisted straight to the
  // person's own profile row (RLS: "own profile writable", auth.uid() = id, no
  // admin client needed). Saving also counts as dismissing — there's nothing left
  // to prompt for.
  async function saveChopName() {
    const name = chopName.trim();
    if (!name) return;
    setChopSaving(true);
    try {
      const { data: { user } } = await supabaseBrowser().auth.getUser();
      if (!user) return;
      const { error } = await supabaseBrowser().from('profiles').update({ display_name: name }).eq('id', user.id);
      if (!error) { dismissChopPrompt(); await refresh(); }
    } finally {
      setChopSaving(false);
    }
  }

  /**
   * "Order" (real registered table, orderable=true) vs "Picked" (a plain community
   * table session) — the label alone tells the whole story, and it's not a client
   * guess: `orderable` comes straight from whether this session has a table_id,
   * i.e. whether it originated from a restaurant's own QR code.
   *
   * Honest scope note: for an ORDERABLE session joined here (via a code, not the
   * QR scan itself), this still creates a PICK — an interest signal the owner's
   * dashboard sees — not a live kitchen order through the cart/quantity-stepper
   * flow that /order/[token] has. Unifying those two paths is a real follow-up,
   * not something this pass silently pretends to already do.
   */
  // Own name for the chop a broadcast stamp carries — the SAME fallback chain
  // rendered everywhere else (display_name, then the auto-handle).
  const myName = (s: SessionState) => {
    const me = s.members.find(m => m.user_id === s.you);
    return me?.display_name ?? me?.handle ?? 'someone';
  };

  // One shared helper for applying a stamp event, whether it came from the network
  // or from MY OWN action — so a local pick/unpick and a received broadcast go
  // through the exact same reducer (tableStamps.ts), never two slightly-different
  // code paths that could drift.
  function applyLocalStampEvent(itemKey: string, event: StampEvent) {
    setRealtimeStamps(prev => ({ ...prev, [itemKey]: applyStampEvent(prev[itemKey] ?? {}, event) }));
  }
  function broadcastStamp(itemKey: string, event: StampEvent) {
    channelRef.current?.send({ type: 'broadcast', event: event.type, payload: { item_key: itemKey, user_id: event.user_id, name: event.name } });
  }

  async function pickDish(item: RankedItem, state: SessionState) {
    setPicking(item.key);
    try {
      const res = await fetch('/api/dishes/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: state.restaurant_id ?? undefined,
          table_session_id: state.session_id,
          items: [{ name: item.name, name_zh: item.name_zh, cuisine: item.cuisine, attributes: item.attributes ?? {}, table_item_key: item.key }],
        }),
      });
      const json = await res.json().catch(() => null);
      const dishId = json?.picked?.[0]?.id as string | undefined;
      if (res.ok && dishId) {
        setPendingDishIds(prev => ({ ...prev, [item.key]: dishId }));
        const event: StampEvent = { type: 'pick', user_id: state.you, name: myName(state) };
        applyLocalStampEvent(item.key, event); // instant local thunk — matches scan's own chop
        broadcastStamp(item.key, event);       // instant for everyone else at the table; also flips "picked" (derived from stamps) immediately
      }
    } finally {
      setPicking(null);
    }
  }

  // Un-pick (item 3): DELETEs the dish row /api/dishes/pick created — the same
  // owning-user-scoped endpoint the queue's own 刪除 trash icon already uses, so
  // there's no new deletion path to reason about, just a new caller of it. Finds
  // MY OWN pick via the same pickMatchesItem rule stamps use (state.table_picks is
  // server truth), falling back to pendingDishIds only for the brief window right
  // after a pick before the next poll has landed.
  async function unpickDish(item: RankedItem, state: SessionState) {
    const mine = state.table_picks.find(p => p.user_id === state.you && pickMatchesItem(p, item));
    const dishId = mine?.id ?? pendingDishIds[item.key];
    if (!dishId) return;
    setPicking(item.key);
    try {
      const res = await fetch('/api/my/dishes', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dishId }),
      });
      if (res.ok) {
        setPendingDishIds(prev => { const { [item.key]: _, ...rest } = prev; return rest; });
        const event: StampEvent = { type: 'unpick', user_id: state.you, name: myName(state) };
        applyLocalStampEvent(item.key, event);
        broadcastStamp(item.key, event);
      }
    } finally {
      setPicking(null);
    }
  }

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/table/${code}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setState(json);
      setError('');
      // The poll is authoritative the moment it lands — clear the realtime overlay
      // so a stale entry (e.g. an unpick broadcast this client missed) can never
      // outlive the DB truth for more than one poll cycle. See tableStamps.ts.
      setRealtimeStamps({});
      setPendingDishIds({}); // state.table_picks now carries the real id for anything pending
    } catch (e: any) {
      setError(e.message || 'Lost the table.');
    }
  }, [code]);

  // Add a page: any member can grow the shared scanned menu now (item 6,
  // owner decision 2026-07-22 — open trust model, no confirmation gate).
  //
  // Deliberately NOT a call into scan/page.tsx's onPick: that function is
  // built around a scanner's own local `result` state (incremental per-item
  // rendering, dedup against ITS OWN accumulated items, restaurant-guess
  // reconciliation) that this screen doesn't have and doesn't need — the
  // shared ranked list below is the only view of the menu here, refreshed by
  // the normal poll (or immediately, right after this succeeds). Reusing it
  // would mean threading a `result`-shaped stand-in through a component that
  // was never meant to hold one, for a screen that has nowhere to show
  // per-item progress anyway. What IS shared: the same three endpoints
  // (/api/menu-scan stream, its enrich/score stages) and shapeTableMenuItems
  // server-side — this is a second CALLER of that pipeline, not a second
  // implementation of it.
  async function addPage(file: File | null) {
    if (!file) return;
    setAppending(true);
    setAppendError('');
    try {
      const form = new FormData();
      form.append('photo', await normalizePhoto(file));
      form.append('lang', lang);
      const res = await fetch('/api/menu-scan', { method: 'POST', body: form });
      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as any).error || 'Scan failed.');
      }

      // Same NDJSON line-delimited stream scan/page.tsx consumes, but nothing
      // here needs the per-item events as they arrive — this screen has no
      // incremental view to update, so just collect the final item list.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = '';
      let items: ScanPageItem[] = [];
      let meta: { mock: boolean; phase: 'done' | 'needs_scoring' } | null = null;

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: any;
          try { ev = JSON.parse(line); } catch { continue; } // one bad line must never sink an otherwise-good scan
          if (ev.kind === 'start') meta = ev;
          else if (ev.kind === 'item') items.push(ev.item as ScanPageItem);
          else if (ev.kind === 'error') {
            const err: any = new Error(ev.error);
            err.reason = ev.reason;
            throw err;
          }
        }
      }
      if (!meta) throw new Error('Scan ended unexpectedly.');
      if (items.length === 0) return; // a page with nothing readable is a quiet no-op, not an error

      // Stage 2 (enrich) always runs; Stage 3 (score, real taste attributes) only
      // when the profile is ready — same gating scan/page.tsx's own append uses,
      // so a member without enough ratings yet still contributes fully-visible
      // dishes, just without personal match/fire (which this shared list doesn't
      // render per-item anyway — group_match comes from rankForGroup server-side).
      const enrichPromise = meta.mock ? Promise.resolve(null as (ScanPageItem | null)[] | null) : mapWithConcurrency(
        items, SCORE_CONCURRENCY,
        async (item) => {
          const r = await fetch('/api/menu-scan/enrich', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item }),
          });
          if (!r.ok) throw new Error('enrich failed');
          return (await r.json()).item as ScanPageItem;
        },
      ).catch(() => null);

      const scorePromise: Promise<(ScanPageItem | null)[] | null> = meta.phase === 'needs_scoring'
        ? mapWithConcurrency(
            items, SCORE_CONCURRENCY,
            async (item) => {
              const r = await fetch('/api/menu-scan/score', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item, lang }),
              });
              if (!r.ok) throw new Error('score failed');
              return (await r.json()).item as ScanPageItem;
            },
          ).catch(() => null)
        : Promise.resolve(null);

      const [enriched, scored] = await Promise.all([enrichPromise, scorePromise]);

      const forTable = items.map((item, i) => {
        const e = enriched?.[i];
        const s = scored?.[i];
        return {
          name: item.name, name_zh: item.name_zh, name_original: item.name_original, price: item.price,
          hook: e?.hook ?? item.hook, cuisine: item.cuisine,
          attributes: s?.attributes ?? item.attributes ?? {},
          diet: e?.diet ?? item.diet, cooking_method: e?.cooking_method ?? item.cooking_method,
          heaviness: e?.heaviness ?? item.heaviness, ingredients: e?.ingredients ?? item.ingredients,
        };
      });

      const patchRes = await fetch(`/api/table/${code}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: forTable }),
      });
      const patchJson = await patchRes.json().catch(() => null);
      if (!patchRes.ok) throw new Error(patchJson?.error || 'Could not add that page.');
      await refresh(); // pull the grown shared list immediately, don't wait for the next 5s poll tick
    } catch (e: any) {
      const localized = e?.reason === 'not_menu' ? t('scan.err.notmenu')
        : e?.reason === 'unreadable' ? t('scan.err.unreadable')
        : null;
      setAppendError(localized || e.message || 'Something went wrong reading that menu.');
    } finally {
      setAppending(false);
    }
  }

  // Realtime channel: one per session, subscribed once we know session_id (arrives
  // async via the first refresh()). `self: false` because a local pick/unpick is
  // already applied instantly via applyLocalStampEvent — receiving our own broadcast
  // back would just be a redundant (harmless, since applyStampEvent is idempotent,
  // but pointless) round-trip.
  useEffect(() => {
    if (!state?.session_id) return;
    const supabase = supabaseBrowser();
    const channel = supabase.channel(`table:${state.session_id}`, { config: { broadcast: { self: false } } });
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
  }, [state?.session_id]);

  // Poll every 5s while open, so rankings shift live as friends join.
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function share() {
    const url = `${window.location.origin}/table?code=${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: t('table.sharetitle'), url }); return; } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(url);
    alert(t('table.copied'));
  }

  if (error) return (
    <div>
      <p style={{ color: 'var(--lacquer)' }}>{error}</p>
      <button className="btn ghost small" onClick={onLeave}>{t('table.back')}</button>
    </div>
  );
  if (!state) return <p className="card-meta">{t('table.pulling')}</p>;

  // Per-item stamps (item 3): poll-derived base (stampsFromPicks, name-matched
  // against table_picks — self-heals every 5s regardless of realtime) merged with
  // the realtime latency overlay. Recomputed each render; state.items/table_picks
  // are small (≤15/≤30), so this is cheap enough not to need memoizing.
  const stampsByKey = new Map(
    state.items.map(it => [
      it.key,
      mergeStamps(stampsFromPicks(it, state.table_picks), realtimeStamps[it.key] ?? {}),
    ]),
  );
  const STAMP_CAP = 5;

  // Distinct dishes with at least one stamp, live-merged (poll + realtime overlay)
  // — the ONE list the table-bar header's count AND the footer both derive from
  // (owner correction, 2026-07-21). state.table_picks.length was wrong two ways:
  // it's raw PICK ROWS, not distinct dishes (two people picking the same dish
  // inflated it), and it's poll-only, so it lagged up to 5s behind what the
  // stamps/filled cards already showed instantly — pick/unpick fast enough and the
  // header count visibly disagreed with the rows underneath it.
  const anyPickedItems = state.items.filter(it => (stampsByKey.get(it.key) ?? []).length > 0);

  // Per-member fire (owner request, 2026-07-21): same "genuinely positive, capped
  // for scarcity" discipline scan's own solo fire uses (there: top 2 by raw_score
  // past a confidence gate), adapted to member_matches' ABSOLUTE per-member percent
  // (not the batch-relative group_match). 55 is the exact percent equivalent of
  // rankForGroup's own POSITIVE_RAW floor (see group.ts's derivation comment) — the
  // same bar `unanimous` already uses, not a new threshold invented for display.
  const FIRE_MATCH_FLOOR = 55;
  const FIRE_CAP_PER_MEMBER = 2;
  const fireByKey = new Map<string, { userId: string; color: string }[]>();
  for (const member of state.members) {
    if (!member.has_profile) continue;
    const top = state.items
      .map(it => ({ key: it.key, match: it.member_matches.find(m => m.handle === member.handle)?.match ?? 0 }))
      .filter(x => x.match >= FIRE_MATCH_FLOOR)
      .sort((a, b) => b.match - a.match)
      .slice(0, FIRE_CAP_PER_MEMBER);
    const color = chopColor(member.display_name ?? member.handle);
    for (const t of top) {
      const arr = fireByKey.get(t.key) ?? [];
      arr.push({ userId: member.user_id, color });
      fireByKey.set(t.key, arr);
    }
  }

  return (
    <div>
      {/* Title row + 讀到 N 道菜 — the EXACT header language scan's own results
          screen uses (t('scan.results')/t('scan.read')), not a table-specific
          rewrite of it. A session started from a join code reads as the same
          product moment as one started from a scan. 離開 lives here now (icon-
          only, right-aligned against the title) rather than as a text button
          crowding the table bar (owner feedback, 2026-07-21) — the member-
          roster chip row was dropped outright for the same reason: it only
          repeated names the per-dish chop stamps below already carry. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h1 style={{ margin: 0 }}>{t('scan.results')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Add a page (item 6, 2026-07-22): any member, not just the host who
              started the table — only meaningful for a scan-shared session
              (has_menu && !orderable; a QR/restaurant session's menu comes from
              its live-curated items, PATCH /api/table/[code] rejects appends
              there). Same label/loading copy as scan/page.tsx's own 加掃一版. */}
          {state.has_menu && !state.orderable && (
            <label className={`btn ghost small ${appending ? 'is-disabled' : ''}`} style={{ cursor: appending ? 'default' : 'pointer' }}>
              <input type="file" accept="image/*" hidden disabled={appending}
                onChange={e => { const f = e.target.files?.[0] ?? null; e.target.value = ''; addPage(f); }} />
              {appending ? t('scan.addingpage') : t('scan.addpage')}
            </label>
          )}
          <button className="icon-btn" aria-label={t('table.leave')} title={t('table.leave')} onClick={onLeave}>
            <LeaveIcon size={22} />
          </button>
        </div>
      </div>
      {/* marginTop 13 (owner request, 2026-07-21): shifts this line + the table
          bar below it down as a pair, without touching their own spacing to
          each other or to the title row above. */}
      <p className="card-meta" style={{ marginTop: 13, marginBottom: 6 }}>
        {t('scan.read', { n: state.items.length })}
      </p>
      {appending && (
        <div className="scan-appending" role="status">
          <span className="scan-appending-dot" aria-hidden />
          {t('scan.addingpage')}
        </div>
      )}
      {appendError && (
        <p className="card-meta" style={{ color: 'var(--lacquer)', marginBottom: 6 }} role="alert">
          {appendError}
        </p>
      )}

      {/* The table-bar — literally the same component scan.tsx mounts for its own
          "sharing a scan" glance (TableBar.tsx), not a look-alike header. Its own
          CSS margin-bottom (22px) is what now nets a clean ~7px gap against
          .scan-settle's shared -15px margin-top below (see DishListRow's own
          settled-list neighbor for the same math) — palate-blend copy used to sit
          here doing that job; removed outright (owner request, 2026-07-21), the
          table bar's existing margin already does it. */}
      <TableBar code={state.code} memberCount={state.members.length} pickCount={anyPickedItems.length}
        onInvite={share} />

      {/* One-time 名印 setup: only for the viewer's own row, only once per device
          (see CHOP_PROMPT_DISMISSED_KEY) — a genuinely optional identity touch,
          never a blocking gate on using the table. */}
      {!chopDismissed && state.members.find(m => m.user_id === state.you && !m.display_name) && (
        <div className="card" style={{ marginBottom: 14 }}><div className="card-body">
          <p style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>{t('table.chop.title')}</p>
          <p className="card-meta" style={{ marginBottom: 10 }}>{t('table.chop.blurb')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="field" value={chopName} maxLength={24}
              placeholder={t('table.chop.placeholder')}
              onChange={e => setChopName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveChopName(); }} />
            <button className={`btn primary small ${chopName.trim() ? 'dirty' : ''}`}
              disabled={!chopName.trim() || chopSaving} onClick={saveChopName}>
              {chopSaving ? t('log.saving') : t('home.save')}
            </button>
          </div>
          <button className="btn ghost small" style={{ marginTop: 8 }} onClick={dismissChopPrompt}>
            {t('table.chop.skip')}
          </button>
        </div></div>
      )}

      {/* THE shared list — DishListRow, the exact same component scan/page.tsx's
          own settled results render. No SINGLE fire (scan's own solo-match claim
          doesn't apply to a group), no cuisine chip, no inline pick pill: DishListRow
          never had those, nothing to suppress. fireFor IS table's own per-member
          equivalent (owner request, 2026-07-21) — one small 🔥 dotted per member
          this dish suits, distinct from the pick stamps below (predicted vs actual). */}
      <div className="scan-settle">
        {state.items.map((item, i) => {
          const stamps = stampsByKey.get(item.key) ?? [];
          // Picked = my own stamp is present, full stop — never a separate flag
          // that could say something different than the "W" everyone (including
          // me) sees under the dish (owner correction, 2026-07-21).
          const picked = stamps.some(s => s.user_id === state.you);
          return (
            <DishListRow
              key={item.key}
              item={{
                key: item.key, name: item.name, name_zh: item.name_zh, name_original: item.name_original,
                price: item.price, cooking_method: item.cooking_method, heaviness: item.heaviness,
                diet: item.diet, ingredients: item.ingredients, enriched: item.enriched,
              }}
              rank={i + 1}
              picked={picked}
              fireFor={fireByKey.get(item.key)}
              onSelect={() => {
                if (picking) return; // ignore a second tap while the first is still in flight
                if (picked) unpickDish(item, state); else pickDish(item, state);
              }}
              // No pickedBy text — the chop stamp already carries who (owner
              // feedback, 2026-07-21): stacking a stamp AND a repeated "{name}
              // 也選了" line under every picked dish was the crowding.
              stamps={stamps.length > 0 ? (
                // Right-aligned under the price, spaced not overlapped (owner
                // request, 2026-07-21) — capped at STAMP_CAP with a "+N" overflow
                // badge so a table of 12 people piling onto one dish doesn't blow
                // out the row's width. Each chop's key is stable (item.key +
                // user_id), so its mount pop-in animation plays exactly once, the
                // moment IT specifically joins.
                <div className="chop-stamp-row" style={{ marginTop: 5 }} aria-label={t('table.stampedby', { n: stamps.length })}>
                  {stamps.slice(0, STAMP_CAP).map(s => (
                    <span className="chop-stamp-pop" key={`${item.key}:${s.user_id}`}>
                      <Chop name={s.name} size={26} />
                    </span>
                  ))}
                  {stamps.length > STAMP_CAP && <span className="chop-stamp-overflow">+{stamps.length - STAMP_CAP}</span>}
                </div>
              ) : undefined}
            />
          );
        })}
      </div>

      {/* Footer bar: the WHOLE TABLE's picks THIS session (same anyPickedItems the
          header count above uses — they can no longer disagree), count + running
          price — same cart-bar chrome scan uses for its own (solo) pick summary,
          read-only here (no batch confirm step; each pick already persisted the
          moment it was tapped above). The per-row filled-card highlight stays
          mine-only — that's a different, correct distinction ("did I pick this"),
          not a bug. Appears once there's something to show. */}
      {(() => {
        const pickedItems = anyPickedItems;
        if (!pickedItems.length) return null;
        const priceSummary = sumPrices(pickedItems.map(i => i.price ?? null));
        const priceLabel = priceSummary.parsedCount > 0
          ? `${priceSummary.currency}${priceSummary.total}${priceSummary.complete ? '' : '+'}`
          : null;
        return (
          <div className="cart-bar">
            <div className="btn primary cart-btn" style={{ pointerEvents: 'none' }}>
              <span>{t('scan.pickcount', { n: pickedItems.length })}</span>
              {priceLabel && <span className="cart-total">{priceLabel}</span>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
