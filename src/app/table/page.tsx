'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
<<<<<<< HEAD
import DishName from '@/components/DishName';
import { useLang } from '@/lib/i18n';

type Member = { handle: string; has_profile: boolean; rating_count: number };
type RankedItem = {
  key: string; name: string; name_zh?: string | null; name_original?: string; price?: string | null;
=======

type Member = { handle: string; has_profile: boolean; rating_count: number };
type RankedItem = {
  key: string; name: string; name_original?: string; price?: string | null;
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
  hook?: string; cuisine: string | null; photo_url?: string | null;
  group_match: number; member_matches: { handle: string; match: number }[];
  unanimous: boolean; protected_by_fairness: boolean;
};
type SessionState = {
  code: string; status: string; is_host: boolean; has_menu: boolean;
  members: Member[]; items: RankedItem[];
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
<<<<<<< HEAD
  const { t } = useLang();
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
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
<<<<<<< HEAD
      setError(e.message || t('table.starting'));
=======
      setError(e.message || 'Could not start the table.');
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
      setError(e.message || t('table.joining'));
=======
      setError(e.message || 'Could not join.');
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
    } finally { setBusy(null); }
  }

  return (
    <div>
<<<<<<< HEAD
      <h1 style={{ marginBottom: 4 }}>{t('table.title')}</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        {t('table.blurb')}
      </p>

      <div className="card"><div className="card-body">
        <h3>{t('table.start')}</h3>
        <p className="card-meta" style={{ margin: '4px 0 10px' }}>
          {t('table.start.blurb')}
=======
      <h1 style={{ marginBottom: 4 }}>Eat together</h1>
      <p className="card-meta" style={{ marginBottom: 16 }}>
        Everyone joins with a code, and the menu gets ranked so <em>nobody</em> at the table gets sacrificed —
        not just averaged.
      </p>

      <div className="card"><div className="card-body">
        <h3>Start a table</h3>
        <p className="card-meta" style={{ margin: '4px 0 10px' }}>
          Snap the menu (optional) — otherwise the table ranks dishes from around Dishi.
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
        </p>
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment"
          className="field" onChange={e => setMenuFile(e.target.files?.[0] ?? null)}
        />
        <button className="btn primary" style={{ width: '100%', marginTop: 10 }}
          disabled={busy !== null} onClick={createTable}>
<<<<<<< HEAD
          {busy === 'create' ? (menuFile ? t('table.readingmenu') : t('table.starting')) : t('table.start')}
=======
          {busy === 'create' ? (menuFile ? 'Reading the menu…' : 'Setting the table…') : 'Start a table'}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
        </button>
      </div></div>

      <div className="card"><div className="card-body">
<<<<<<< HEAD
        <h3>{t('table.join')}</h3>
=======
        <h3>Join a table</h3>
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="field code-input" placeholder="ABCDE" maxLength={5}
            value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
          />
          <button className="btn" disabled={busy !== null || joinCode.length !== 5} onClick={joinTable}>
<<<<<<< HEAD
            {busy === 'join' ? t('table.joining') : t('table.joinbtn')}
=======
            {busy === 'join' ? 'Joining…' : 'Join'}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
          </button>
        </div>
      </div></div>

      {error && <p style={{ color: 'var(--lacquer)' }}>{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- session ----
function Session({ code, onLeave }: { code: string; onLeave: () => void }) {
<<<<<<< HEAD
  const { t } = useLang();
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

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
<<<<<<< HEAD
      try { await navigator.share({ title: t('table.sharetitle'), url }); return; } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(url);
    alert(t('table.copied'));
=======
      try { await navigator.share({ title: 'Join my table on Dishi', url }); return; } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(url);
    alert('Link copied — send it to the table.');
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
  }

  if (error) return (
    <div>
      <p style={{ color: 'var(--lacquer)' }}>{error}</p>
<<<<<<< HEAD
      <button className="btn ghost small" onClick={onLeave}>{t('table.back')}</button>
    </div>
  );
  if (!state) return <p className="card-meta">{t('table.pulling')}</p>;
=======
      <button className="btn ghost small" onClick={onLeave}>Back</button>
    </div>
  );
  if (!state) return <p className="card-meta">Pulling up the table…</p>;
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c

  const profiled = state.members.filter(m => m.has_profile).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ marginBottom: 4 }}>Table <span className="table-code">{state.code}</span></h1>
<<<<<<< HEAD
        <button className="btn ghost small" onClick={onLeave}>{t('table.leave')}</button>
=======
        <button className="btn ghost small" onClick={onLeave}>Leave</button>
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
      </div>

      <div className="chips" style={{ margin: '8px 0' }}>
        {state.members.map(m => (
          <span key={m.handle} className={`chip ${m.has_profile ? 'on' : ''}`}>
<<<<<<< HEAD
            {m.handle}{!m.has_profile && <span style={{ opacity: 0.55 }}> · {t('table.noprofile')}</span>}
          </span>
        ))}
        <button className="chip" onClick={share}>{t('table.invite')}</button>
      </div>

      <p className="card-meta" style={{ marginBottom: 14 }}>
        {profiled < 2 ? t('table.few') : t('table.ranked', { n: profiled })}
        {!state.has_menu && ` ${t('table.nomenu')}`}
=======
            {m.handle}{!m.has_profile && <span style={{ opacity: 0.55 }}> · no profile yet</span>}
          </span>
        ))}
        <button className="chip" onClick={share}>+ Invite</button>
      </div>

      <p className="card-meta" style={{ marginBottom: 14 }}>
        {profiled < 2
          ? 'Rankings get interesting once two or more taste profiles are at the table.'
          : `Ranked for ${profiled} palates — a dish only wins if it works for everyone.`}
        {!state.has_menu && ' (No menu attached — ranking dishes from around Dishi.)'}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
      </p>

      {state.items.map((item, i) => (
        <article className="card" key={item.key}>
          <div className="card-body scan-row">
            <div className="scan-rank">{i + 1}</div>
            <div className="group-ring" style={{
              background: `conic-gradient(${item.group_match >= 70 ? 'var(--jade)' : item.group_match >= 45 ? 'var(--egg-tart)' : 'var(--ink-soft)'} ${item.group_match * 3.6}deg, var(--line) 0deg)`,
            }}>
              <span>{item.group_match}</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title" style={{ fontSize: 15.5 }}>
<<<<<<< HEAD
                <DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} />
                {item.unanimous && <span className="badge-unanimous">{t('table.unanimous')}</span>}
                {item.protected_by_fairness && <span className="badge-fair">{t('table.fairness')}</span>}
              </div>
              <div className="card-meta">
=======
                {item.name}
                {item.unanimous && <span className="badge-unanimous">whole table</span>}
                {item.protected_by_fairness && <span className="badge-fair">fairness call</span>}
              </div>
              <div className="card-meta">
                {item.name_original && item.name_original !== item.name ? `${item.name_original} · ` : ''}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
                {item.price ? `${item.price} · ` : ''}{item.hook ?? item.cuisine ?? ''}
              </div>
              <button className="btn ghost small" style={{ marginTop: 6 }}
                onClick={() => setExpanded(expanded === item.key ? null : item.key)}>
<<<<<<< HEAD
                {expanded === item.key ? t('table.hide') : t('table.see')}
=======
                {expanded === item.key ? 'Hide the table\u2019s take' : 'See the table\u2019s take'}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
              </button>
              {expanded === item.key && (
                <div className="bars" style={{ marginTop: 8 }}>
                  {item.member_matches.map(mm => (
                    <div className="bar-row" key={mm.handle}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mm.handle}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{
                          left: 0, width: `${mm.match}%`,
                          background: mm.match >= 55 ? 'var(--jade)' : 'var(--ink-soft)',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
