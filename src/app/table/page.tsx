'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
// Chop itself is deliberately NOT imported here: the stamp row is ChopStampRow's
// job, and reaching for the bare glyph again is how a lookalike starts.
import ChopStampRow from '@/components/ChopStampRow';
import TableRestaurantLine from '@/components/TableRestaurantLine';
import DishListRow from '@/components/DishListRow';
import TableBar from '@/components/TableBar';
import { LeaveIcon } from '@/components/icons';
import { useLang, hasNonChineseScript } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';
import { normalizePhoto } from '@/lib/image';
import { createTaskPool } from '@/lib/concurrency';
import { mergeFinalScanItems } from '@/lib/tableMenuItems';
import { countStampedDishes } from '@/lib/tableStamps';
import PickedCartBar from '@/components/PickedCartBar';
import TableWaitLayer from '@/components/TableWaitLayer';
import TableSettle from '@/components/TableSettle';
import { shareLink } from '@/lib/share';
import Toast, { useToast } from '@/components/Toast';
import { supabaseBrowser } from '@/lib/supabase/client';
// The table-session engine — poll, realtime, stamps, pick/unpick — lives in ONE
// place that /scan mounts too. This page used to own all of it inline, and /scan
// had a weaker copy that drifted (see useTableSession's own header note).
import { useTableSession, type RankedItem } from '@/lib/useTableSession';

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

// Member / RankedItem / TablePick / SessionState now live with the engine in
// useTableSession.ts — they are the shared contract between the two screens that
// mount it, not this page's private shapes.

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
  const { t } = useLang();
  // Set only once the join has taken — never straight from the URL. Mounting
  // Session first would start the poll, and GET refuses non-members.
  const [code, setCode] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('code');
    if (!p) { router.replace('/scan'); return; }
    const target = p.toUpperCase();
    // The link IS the invite (owner, 2026-07-31): arriving with ?code= joins you
    // before the session view mounts. Without this the code in the URL was
    // decoration — GET /api/table/[code] refuses non-members, membership was
    // only ever written by the join box on /scan where you TYPE the code, so an
    // invited person tapped the link and landed on "Join this table first" with
    // no join anywhere in reach. Tapping a shared code and typing one are the
    // same act of consent, so they run the same endpoint. Join is idempotent
    // (a member re-opening their own link is a no-op that also re-runs the
    // companion-edge self-heal — see /api/table/join), and for a signed-out
    // recipient AuthGate renders its OTP form ON this URL with no navigation,
    // so the code survives the sign-in wall by construction.
    let cancelled = false;
    setJoining(true);
    (async () => {
      try {
        const res = await fetch('/api/table/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: target }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not join this table.');
        if (!cancelled) setCode(target);
      } catch (e: any) {
        if (!cancelled) setJoinError(e.message || 'Could not join this table.');
      } finally {
        if (!cancelled) setJoining(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // No such table / table closed: the same quiet error-plus-exit Session itself
  // uses when the poll fails, not a new surface.
  if (joinError) return (
    <div>
      <p style={{ color: 'var(--lacquer)' }}>{joinError}</p>
      <button className="btn ghost small" onClick={() => router.push('/scan')}>{t('table.back')}</button>
    </div>
  );
  if (!code) return joining ? <p className="card-meta">{t('table.joining')}</p> : null;
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
  // Confirms the invite-link copy (desktop, where there's no OS share sheet) in
  // the app's own pill rather than a browser alert.
  const toast = useToast();
  // "Picked" is never its own local flag (owner correction, 2026-07-21): a dish is
  // picked iff MY OWN stamp is present, derived from the same stamps list
  // everyone else's chops come from — a Set that only updated on click drifted
  // from server truth on reload. That rule, the realtime overlay, and pick/unpick
  // all live in the shared engine now.
  const {
    state, error, refresh, toggle, stampsFor, isPicked, colorFor,
    restaurant, setRestaurant,
    setReady, choosePayMethod, iAmReady, settled, payMethod, payerId,
    game, startDiceGame, pickDirection, callBid, openCups,
  } = useTableSession(code);
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

      // Same NDJSON line-delimited stream scan/page.tsx consumes. This screen
      // has no incremental view to update, but stages 2/3 are still PIPELINED
      // per item (same 2026-07-29 fix as scan/page.tsx): each dish's
      // enrich/score calls fire the moment its item event arrives, so a
      // stalled stream tail no longer delays the whole page-add by its length.
      //
      // Stage 2 (enrich) always runs; Stage 3 (score, real taste attributes)
      // only when the profile is ready — so a member without enough ratings
      // yet still contributes fully-visible dishes, just without personal
      // match/fire (which this shared list doesn't render per-item anyway —
      // group_match comes from rankForGroup server-side).
      const enrichPool = createTaskPool<ScanPageItem>(SCORE_CONCURRENCY);
      const scorePool = createTaskPool<ScanPageItem>(SCORE_CONCURRENCY);
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
          else if (ev.kind === 'item') {
            const item = ev.item as ScanPageItem;
            const index = items.length;
            items.push(item);
            if (meta && !meta.mock) {
              enrichPool.push(index, async () => {
                const r = await fetch('/api/menu-scan/enrich', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item }),
                });
                if (!r.ok) throw new Error('enrich failed');
                return (await r.json()).item as ScanPageItem;
              });
              if (meta.phase === 'needs_scoring') {
                scorePool.push(index, async () => {
                  const r = await fetch('/api/menu-scan/score', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item, lang }),
                  });
                  if (!r.ok) throw new Error('score failed');
                  return (await r.json()).item as ScanPageItem;
                });
              }
            }
          } else if (ev.kind === 'error') {
            const err: any = new Error(ev.error);
            err.reason = ev.reason;
            throw err;
          }
        }
      }
      if (!meta) throw new Error('Scan ended unexpectedly.');
      if (items.length === 0) return; // a page with nothing readable is a quiet no-op, not an error

      // Kana/hangul tripwire — the SAME namefix pass scan/page.tsx runs on its
      // own pages. This path skipped it entirely, so a Japanese page appended
      // from HERE landed on the shared menu untranslated, permanently (the
      // shared session is what everyone reads; there's no later local pass to
      // paper over it). Best-effort like everything else in this pipeline.
      const tripped = items.filter(it => hasNonChineseScript(it.name_zh));
      const namefixPromise: Promise<Record<string, string>> = (meta.mock || tripped.length === 0) ? Promise.resolve({}) : fetch('/api/menu-scan/fix-names', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: tripped.map(it => ({ key: it.name_original, name: it.name, name_zh: it.name_zh })) }),
      })
        .then(r => r.ok ? r.json() : { names: {} })
        .then((j: { names?: Record<string, string> }) => j.names ?? {})
        .catch(() => ({}));

      const [enriched, scored, nameFixes] = await Promise.all([enrichPool.drain(), scorePool.drain(), namefixPromise]);

      const forTable = mergeFinalScanItems(items, enriched, scored, nameFixes);

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

  // Realtime subscription and the 5s poll both live in useTableSession now —
  // this page no longer owns a second copy of either.

  async function share() {
    const url = `${window.location.origin}/table?code=${code}`;
    // Behaviour change, deliberate: dismissing the OS sheet used to fall
    // through to the clipboard and alert about it. shareLink treats a
    // dismissal as the answer (see its AbortError note).
    // The code rides the message body as well as the query string: messengers
    // drop the title freely, and a recipient whose link gets mangled can still
    // type five characters into the join box. The invite must survive with the
    // CODE legible, not just as a URL that works when nothing interferes.
    if (await shareLink({
      title: t('table.sharetitle'),
      text: t('table.sharetext', { code }),
      url,
    }) === 'copied') toast.show(t('table.copied'));
  }

  if (error) return (
    <div>
      <p style={{ color: 'var(--lacquer)' }}>{error}</p>
      <button className="btn ghost small" onClick={onLeave}>{t('table.back')}</button>
    </div>
  );
  if (!state) return <p className="card-meta">{t('table.pulling')}</p>;

  // Per-item stamps: poll-derived base merged with the realtime overlay, from the
  // shared engine. Recomputed each render; items/table_picks are small (≤15/≤30),
  // so this is cheap enough not to need memoizing.
  const stampsByKey = new Map(state.items.map(it => [it.key, stampsFor(it)]));

  // Distinct dishes with at least one stamp, live-merged (poll + realtime overlay)
  // — the ONE list the table-bar header's count AND the footer both derive from
  // (owner correction, 2026-07-21). state.table_picks.length was wrong two ways:
  // it's raw PICK ROWS, not distinct dishes (two people picking the same dish
  // inflated it), and it's poll-only, so it lagged up to 5s behind what the
  // stamps/filled cards already showed instantly — pick/unpick fast enough and the
  // header count visibly disagreed with the rows underneath it.
  const anyPickedItems = state.items.filter(it => (stampsByKey.get(it.key) ?? []).length > 0);

  // The bill REPLACES the menu rather than sitting over it: once the table has
  // finished picking, the list of dishes to tap is not what anyone is looking at.
  // Driven off the session's settled_at, so every member flips on the same fact
  // (and stays flipped — a late joiner cannot pull the table back to picking).
  if (settled) {
    return (
      <TableSettle
        dishes={anyPickedItems}
        members={state.members}
        you={state.you}
        colorFor={colorFor}
        payMethod={payMethod}
        payerId={payerId}
        onChoose={choosePayMethod}
        sessionId={state.session_id}
        game={game}
        onStartGame={startDiceGame}
        onPickDirection={pickDirection}
        onCallBid={callBid}
        onOpenCups={openCups}
      />
    );
  }

  // The handshake only exists with someone to shake hands with. A lone member
  // keeps the cart bar's original link straight to the rating queue.
  const inGroup = state.members.length >= 2;

  // Per-member fire (owner request, 2026-07-21): same "genuinely positive, capped
  // for scarcity" discipline scan's own solo fire uses (there: top 2 by raw_score
  // past a confidence gate), adapted to member_matches' ABSOLUTE per-member percent
  // (not the batch-relative group_match). 55 is the exact percent equivalent of
  // rankForGroup's own POSITIVE_RAW floor (see group.ts's derivation comment) — the
  // same bar `unanimous` already uses, not a new threshold invented for display.
  const FIRE_MATCH_FLOOR = 55;
  const FIRE_CAP_PER_MEMBER = 2;
  // ONE color assignment for the whole session, from the member set alone —
  // identical on every member's screen, collision-free up to the palette size
  // (chopColorMap's contract). Stamps and fire dots both draw from it, and the
  // chopColorFor fallback only covers a realtime stamp racing the members poll.
  const fireByKey = new Map<string, { userId: string; color: string }[]>();
  for (const member of state.members) {
    if (!member.has_profile) continue;
    const top = state.items
      .map(it => ({ key: it.key, match: it.member_matches.find(m => m.handle === member.handle)?.match ?? 0 }))
      .filter(x => x.match >= FIRE_MATCH_FLOOR)
      .sort((a, b) => b.match - a.match)
      .slice(0, FIRE_CAP_PER_MEMBER);
    const color = colorFor(member.user_id);
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
      <TableBar code={state.code} memberCount={state.members.length}
        pickCount={countStampedDishes(state.items, stampsFor)}
        onInvite={share}
        restaurantLine={
          <TableRestaurantLine
            restaurant={restaurant}
            onChange={setRestaurant}
            // A QR/registered table's restaurant belongs to the restaurant itself,
            // not to whoever sat down at it (the API refuses the change too).
            editable={!state.orderable}
          />
        } />

      {/* One-time 名印 setup: only for the viewer's own row, only once per device
          (see CHOP_PROMPT_DISMISSED_KEY) — a genuinely optional identity touch,
          never a blocking gate on using the table. Suppressed once the username
          is claimed (username_claimed, keyed off username_set_at) even if
          display_name is still empty — a claimed dishi.username already answers
          "what should we call you"; asking again would contradict the claim.
          NEVER key this off handle non-emptiness — every legacy profile has one. */}
      {!chopDismissed && state.members.find(m => m.user_id === state.you && !m.display_name && !m.username_claimed) && (
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
          // that could say something different than the chop everyone (including
          // me) sees under the dish (owner correction, 2026-07-21).
          const picked = isPicked(item);
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
              // Toggle owns the double-tap guard and the pick/unpick choice — the
              // same call /scan makes, so the two can't diverge on what a tap means.
              onSelect={() => toggle(item, {
                cuisine: item.cuisine, attributes: item.attributes ?? {},
                cooking_method: item.cooking_method, heaviness: item.heaviness,
                diet: item.diet, ingredients: item.ingredients,
              })}
              // No pickedBy text — the chop stamp already carries who (owner
              // feedback, 2026-07-21): stacking a stamp AND a repeated "{name}
              // 也選了" line under every picked dish was the crowding.
              stamps={<ChopStampRow itemKey={item.key} stamps={stamps} colorFor={colorFor} />}
            />
          );
        })}
      </div>

      {/* The table's picks + running bill — the SAME component /scan mounts, fed
          the same table-wide list, so every member's bar shows one number (owner
          ruling, 2026-07-30 — see PickedCartBar's header). */}
      <PickedCartBar picked={anyPickedItems} onDone={inGroup ? () => setReady(true) : undefined} />

      {/* I've tapped, the table hasn't finished. Blocks the menu behind it so a
          member who is done can't keep quietly changing the order everyone else
          has already agreed to. */}
      {inGroup && iAmReady && (
        <TableWaitLayer members={state.members} colorFor={colorFor} onKeepPicking={() => setReady(false)} />
      )}
      <Toast message={toast.message} onDone={toast.onDone} />
    </div>
  );
}
