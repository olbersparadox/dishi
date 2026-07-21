'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import Chop from '@/components/Chop';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { stampsFromPicks, mergeStamps, applyStampEvent, type Stamp, type StampEvent } from '@/lib/tableStamps';

type Member = { user_id: string; handle: string; display_name: string | null; has_profile: boolean; rating_count: number };
type RankedItem = {
  key: string; name: string; name_zh?: string | null; name_original?: string; price?: string | null;
  hook?: string; cuisine: string | null; photo_url?: string | null;
  group_match: number; member_matches: { handle: string; match: number }[];
  unanimous: boolean; protected_by_fairness: boolean;
  attributes?: Record<string, number>;
};
type TablePick = {
  user_id: string; name: string; name_zh: string | null;
  handle: string; display_name: string | null;
  identity_name?: string | null; identity_name_zh?: string | null;
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

function Table() {
  const [code, setCode] = useState<string | null>(null);

  // Rejoin from URL (?code=XXXXX) so a shared link drops friends straight in.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('code');
    if (p) setCode(p.toUpperCase());
  }, []);

  return code
    ? <Session code={code} onLeave={() => setCode(null)} />
    : <Landing onEnter={setCode} />;
}

// ---------------------------------------------------------------- landing ----
function Landing({ onEnter }: { onEnter: (code: string) => void }) {
  const { t } = useLang();
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const [menuFile, setMenuFile] = useState<File | null>(null);

  async function createTable() {
    setBusy('create'); setError('');
    try {
      const form = new FormData();
      if (menuFile) form.append('photo', await normalizePhoto(menuFile));
      const res = await fetch('/api/table', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onEnter(json.code);
    } catch (e: any) {
      setError(e.message || t('table.starting'));
    } finally { setBusy(null); }
  }

  async function joinTable() {
    setBusy('join'); setError('');
    try {
      const res = await fetch('/api/table/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onEnter(json.code);
    } catch (e: any) {
      setError(e.message || t('table.joining'));
    } finally { setBusy(null); }
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>{t('table.title')}</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        {t('table.blurb')}
      </p>

      <div className="card"><div className="card-body">
        <h3>{t('table.start')}</h3>
        <p className="card-meta" style={{ margin: '4px 0 10px' }}>
          {t('table.start.blurb')}
        </p>
        <PhotoPicker onPick={f => setMenuFile(f)} />
        <button className="btn primary" style={{ width: '100%', marginTop: 10 }}
          disabled={busy !== null} onClick={createTable}>
          {busy === 'create' ? (menuFile ? t('table.readingmenu') : t('table.starting')) : t('table.start')}
        </button>
      </div></div>

      <div className="card"><div className="card-body">
        <h3>{t('table.join')}</h3>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="field code-input" placeholder="ABCDE" maxLength={5}
            value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
          />
          <button className="btn" disabled={busy !== null || joinCode.length !== 5} onClick={joinTable}>
            {busy === 'join' ? t('table.joining') : t('table.joinbtn')}
          </button>
        </div>
      </div></div>

      {error && <p style={{ color: 'var(--lacquer)' }}>{error}</p>}
    </div>
  );
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
// unifies here) and "your own picks" highlighted via pickedKeys. The percentage-bar
// breakdown (查看全桌的意見) is retired along with the rings — it displayed exact
// numbers scan's OWN settled-list philosophy deliberately avoids (see the "no
// displayed numbers, only an earned mark" comment in scan/page.tsx); 全檯啱 is that
// earned mark's table-mode equivalent, rendered with the same 🔥 tag scan uses.
function Session({ code, onLeave }: { code: string; onLeave: () => void }) {
  const { t, lang } = useLang();
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState<string | null>(null); // item.key currently saving
  const [pickedKeys, setPickedKeys] = useState<Set<string>>(new Set());
  // The dish row id /api/dishes/pick created for each of MY OWN picks — captured from
  // its response so un-picking (below) knows exactly what to DELETE. Keyed by
  // item.key, the same candidate identity pickedKeys already uses.
  const [pickedDishIds, setPickedDishIds] = useState<Record<string, string>>({});
  // Realtime pick stamps (item 3): a LATENCY overlay on top of the poll's own
  // table_picks (see tableStamps.ts for the full architecture note). Cleared after
  // every successful poll, since the poll is authoritative once it lands.
  const [realtimeStamps, setRealtimeStamps] = useState<Record<string, Stamp[]>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
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
    setRealtimeStamps(prev => ({ ...prev, [itemKey]: applyStampEvent(prev[itemKey] ?? [], event) }));
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
          items: [{ name: item.name, name_zh: item.name_zh, cuisine: item.cuisine, attributes: item.attributes ?? {} }],
        }),
      });
      const json = await res.json().catch(() => null);
      const dishId = json?.picked?.[0]?.id as string | undefined;
      if (res.ok && dishId) {
        setPickedKeys(prev => new Set(prev).add(item.key));
        setPickedDishIds(prev => ({ ...prev, [item.key]: dishId }));
        const event: StampEvent = { type: 'pick', user_id: state.you, name: myName(state) };
        applyLocalStampEvent(item.key, event); // instant local thunk — matches scan's own chop
        broadcastStamp(item.key, event);       // instant for everyone else at the table
      }
    } finally {
      setPicking(null);
    }
  }

  // Un-pick (item 3): DELETEs the dish row /api/dishes/pick created — the same
  // owning-user-scoped endpoint the queue's own 刪除 trash icon already uses, so
  // there's no new deletion path to reason about, just a new caller of it. Only
  // ever targets MY OWN pick (pickedDishIds is keyed to what THIS client created).
  async function unpickDish(item: RankedItem, state: SessionState) {
    const dishId = pickedDishIds[item.key];
    if (!dishId) return;
    setPicking(item.key);
    try {
      const res = await fetch('/api/my/dishes', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dishId }),
      });
      if (res.ok) {
        setPickedKeys(prev => { const n = new Set(prev); n.delete(item.key); return n; });
        setPickedDishIds(prev => { const { [item.key]: _, ...rest } = prev; return rest; });
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
    } catch (e: any) {
      setError(e.message || 'Lost the table.');
    }
  }, [code]);

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

  const profiled = state.members.filter(m => m.has_profile).length;

  // Cap which 全檯啱 dishes actually get the 🔥 mark. `unanimous` is "every profiled
  // member's raw score clears a floor" (group.ts) — with a small or single-member
  // table that floor is easy to clear broadly, so an UNCAPPED fire mark could land on
  // most of the menu and stop meaning anything. Same discipline scan/page.tsx already
  // applies to its own fire winners (there: top 2 by raw_score) — here: top 3 by
  // group_match, since 全檯啱 covers more people agreeing, not one person's own match.
  const topUnanimous = new Set(
    state.items
      .filter(it => it.unanimous)
      .sort((a, b) => b.group_match - a.group_match)
      .slice(0, 3)
      .map(it => it.key),
  );

  // Per-item stamps (item 3): poll-derived base (stampsFromPicks, name-matched
  // against table_picks — self-heals every 5s regardless of realtime) merged with
  // the realtime latency overlay. Recomputed each render; state.items/table_picks
  // are small (≤15/≤30), so this is cheap enough not to need memoizing.
  const stampsByKey = new Map(
    state.items.map(it => [
      it.key,
      mergeStamps(stampsFromPicks(it, state.table_picks), realtimeStamps[it.key] ?? []),
    ]),
  );
  const STAMP_CAP = 5;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ marginBottom: 4 }}>Table <span className="table-code">{state.code}</span></h1>
        <button className="btn ghost small" onClick={onLeave}>{t('table.leave')}</button>
      </div>

      <div className="chips" style={{ margin: '8px 0' }}>
        {/* 名印 next to each name — the fallback handle (mosuko-i47v) is what a
            member displays until THEY set a display_name; other people's own
            fallback state is never something this client should nudge about, only
            the viewer's own row triggers the setup prompt below. */}
        {state.members.map(m => (
          <span key={m.user_id} className={`chip chop-row ${m.has_profile ? 'on' : ''}`}>
            <Chop name={m.display_name ?? m.handle} size={20} />
            {m.display_name ?? m.handle}{!m.has_profile && <span style={{ opacity: 0.55 }}> · {t('table.noprofile')}</span>}
          </span>
        ))}
        <button className="chip" onClick={share}>{t('table.invite')}</button>
      </div>

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

      {/* 讀到 N 道菜 — the same header language scan's settled list uses, so a
          table session reads as the same product moment whether it started from a
          scan or a join code. The palate-count line (few/ranked) follows: it's
          genuinely table-specific context (how many taste profiles are blending
          into this ranking) that scan has no equivalent of, so it stays. */}
      <p className="card-meta" style={{ marginBottom: 4 }}>
        {t('table.itemsread', { n: state.items.length })}
      </p>
      <p className="card-meta" style={{ marginBottom: 14 }}>
        {profiled < 2 ? t('table.few') : t('table.ranked', { n: profiled })}
        {!state.has_menu && ` ${t('table.nomenu')}`}
      </p>

      {state.table_picks.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}><div className="card-body">
          <p style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>{t('table.pickedsofar')}</p>
          <div className="chips">
            {state.table_picks.map((p, i) => (
              <span className="chip" key={i}>
                <DishName name={p.name} name_zh={p.name_zh} /> · {p.display_name ?? p.handle}
              </span>
            ))}
          </div>
        </div></div>
      )}

      {/* Numbered rows, no rings, no per-member percentages — the same visual
          grammar as scan's settled list. 全檯啱 (unanimous) gets the identical 🔥
          earned-mark treatment scan gives its own fire dishes: a highlighted card
          border, not a number. 公平之選 stays as a small chip explaining a pick
          that protected someone's interest rather than chasing the raw blend. */}
      <div className="scan-settle">
        {state.items.map((item, i) => {
          const picked = pickedKeys.has(item.key);
          const stamps = stampsByKey.get(item.key) ?? [];
          // 全檯啱 fires on EITHER signal: the predicted taste-blend (topUnanimous,
          // capped) OR real observed convergence — 2+ people actually tapping 揀呢個.
          // The latter is at least as strong a signal as the former (it's OBSERVED,
          // not predicted) and deserves the identical earned-mark treatment.
          const fire = topUnanimous.has(item.key) || stamps.length >= 2;
          return (
            <article
              // scan-pickable gives the flat numbered-row treatment (hanging rank
              // gutter, no per-row border-box) scan's settled list uses; cursor
              // reset to default because — unlike scan, where tapping anywhere on
              // the row toggles a LOCAL pick that still needs a batch confirm step
              // — a table pick here is POSTed immediately and only the button
              // actually does anything, so a pointer cursor over the whole row
              // would be a false affordance.
              className={`card scan-pickable scan-settle-row ${fire ? 'scan-hero' : ''} ${picked ? 'picked' : ''}`}
              style={{ cursor: 'default' }}
              key={item.key}
            >
              <div className="card-body">
                <div className="scan-item">
                  <span className="scan-rank">{i + 1}.</span>
                  <div className="scan-item-main">
                    <div className="dish-row">
                      <div className="card-title" style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                        <DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original}
                          suffix={fire ? <span className="scan-fire" aria-label={t('table.unanimous')}>{'🔥'}</span> : undefined} />
                      </div>
                      {item.price && <span className="dish-price">{item.price}</span>}
                    </div>
                    {item.hook && <div className="card-meta">{item.hook}</div>}
                    {(item.cuisine || item.protected_by_fairness) && (
                      <div className="chips" style={{ marginTop: 4 }}>
                        {item.cuisine && <span className="chip">{cuisineLabel(item.cuisine, lang) || item.cuisine}</span>}
                        {item.protected_by_fairness && <span className="chip">{t('table.fairness')}</span>}
                      </div>
                    )}
                    {/* Chop stamps: who's picked THIS dish, live. Overlap-fan (each
                        chop pulled left over the previous one) capped at STAMP_CAP,
                        with a "+N" overflow badge past that — a table of 12 people
                        piling onto one dish shouldn't blow out the row's height.
                        Each chop's key is stable (item.key + user_id), so its mount
                        pop-in animation (.chop-stamp-pop) plays exactly once, the
                        moment IT specifically joins, never replaying on unrelated
                        re-renders of the row. */}
                    {stamps.length > 0 && (
                      <div className="chop-stamp-row" style={{ marginTop: 6 }} aria-label={t('table.stampedby', { n: stamps.length })}>
                        {stamps.slice(0, STAMP_CAP).map(s => (
                          <span className="chop-stamp-pop" key={`${item.key}:${s.user_id}`}>
                            <Chop name={s.name} size={22} />
                          </span>
                        ))}
                        {stamps.length > STAMP_CAP && (
                          <span className="chop-stamp-overflow">+{stamps.length - STAMP_CAP}</span>
                        )}
                      </div>
                    )}
                    <button
                      // Picked-by-me is now TAPPABLE — un-picking lifts the stamp
                      // (item 3), not a terminal disabled state anymore.
                      className={`btn small ${picked ? 'ghost' : 'primary'}`}
                      style={{ marginTop: 8 }}
                      disabled={picking === item.key}
                      onClick={() => (picked ? unpickDish(item, state) : pickDish(item, state))}
                    >
                      {picking === item.key
                        ? t('log.saving')
                        : picked
                          ? t('table.pickeddone')
                          : state.orderable ? t('table.orderbtn') : t('table.pickbtn')}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Footer bar: your own picks THIS session, count + running price — the
          same cart-bar chrome scan uses for its own pick summary, read-only here
          (no batch confirm step; each pick already persisted the moment it was
          tapped above). Appears once there's something to show. */}
      {(() => {
        const pickedItems = state.items.filter(i => pickedKeys.has(i.key));
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
