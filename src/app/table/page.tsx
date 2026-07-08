'use client';
import { useCallback, useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import { useLang } from '@/lib/i18n';

type Member = { handle: string; has_profile: boolean; rating_count: number };
type RankedItem = {
  key: string; name: string; name_zh?: string | null; name_original?: string; price?: string | null;
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
function Session({ code, onLeave }: { code: string; onLeave: () => void }) {
  const { t } = useLang();
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

      <p className="card-meta" style={{ marginBottom: 14 }}>
        {profiled < 2 ? t('table.few') : t('table.ranked', { n: profiled })}
        {!state.has_menu && ` ${t('table.nomenu')}`}
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
              <div className="dish-row">
                <div className="card-title" style={{ fontSize: 15.5 }}>
                  <DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} />
                  {item.unanimous && <span className="badge-unanimous">{t('table.unanimous')}</span>}
                  {item.protected_by_fairness && <span className="badge-fair">{t('table.fairness')}</span>}
                </div>
                {item.price && <span className="dish-price">{item.price}</span>}
              </div>
              <div className="card-meta">{item.hook ?? item.cuisine ?? ''}</div>
              <button className="btn ghost small" style={{ marginTop: 6 }}
                onClick={() => setExpanded(expanded === item.key ? null : item.key)}>
                {expanded === item.key ? t('table.hide') : t('table.see')}
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
