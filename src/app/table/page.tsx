'use client';
import { useCallback, useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { sumPrices } from '@/lib/price';

type Member = { handle: string; has_profile: boolean; rating_count: number };
type RankedItem = {
  key: string; name: string; name_zh?: string | null; name_original?: string; price?: string | null;
  hook?: string; cuisine: string | null; photo_url?: string | null;
  group_match: number; member_matches: { handle: string; match: number }[];
  unanimous: boolean; protected_by_fairness: boolean;
  attributes?: Record<string, number>;
};
type TablePick = { name: string; name_zh: string | null; handle: string; identity_name?: string | null; identity_name_zh?: string | null };
type SessionState = {
  code: string; session_id: string; restaurant_id: string | null;
  status: string; is_host: boolean; has_menu: boolean; orderable: boolean;
  members: Member[]; items: RankedItem[]; table_picks: TablePick[];
};

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
      if (res.ok) setPickedKeys(prev => new Set(prev).add(item.key));
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
    } catch (e: any) {
      setError(e.message || 'Lost the table.');
    }
  }, [code]);

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ marginBottom: 4 }}>Table <span className="table-code">{state.code}</span></h1>
        <button className="btn ghost small" onClick={onLeave}>{t('table.leave')}</button>
      </div>

      <div className="chips" style={{ margin: '8px 0' }}>
        {state.members.map(m => (
          <span key={m.handle} className={`chip ${m.has_profile ? 'on' : ''}`}>
            {m.handle}{!m.has_profile && <span style={{ opacity: 0.55 }}> · {t('table.noprofile')}</span>}
          </span>
        ))}
        <button className="chip" onClick={share}>{t('table.invite')}</button>
      </div>

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
                <DishName name={p.name} name_zh={p.name_zh} /> · {p.handle}
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
          const fire = topUnanimous.has(item.key);
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
                    <button
                      className={`btn small ${picked ? '' : 'primary'}`}
                      style={{ marginTop: 8 }}
                      disabled={picked || picking === item.key}
                      onClick={() => pickDish(item, state)}
                    >
                      {picked
                        ? t('table.pickeddone')
                        : picking === item.key
                          ? t('log.saving')
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
