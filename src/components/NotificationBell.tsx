'use client';
// Header notification bell — ALWAYS visible (a permanent affordance), and THE
// host surface for taste-calibration interactions (owner direction, 2026-07-28):
// everything /api/interactions/today serves is listed here — 對決 duels,
// stranded 佢哋整得點？ comparisons, and whatever kinds join them later. The
// journal separately surfaces the top two as daily cards (DailyInteractions);
// both read the same feed and re-sync through one window event, so answering
// in either place clears it everywhere.
//
// Red dot = there is at least one notification the user hasn't looked at yet.
// Tapping the bell opens the list AND marks everything currently in it as seen, so
// the dot clears until a genuinely NEW notification (a new id) arrives. Seen ids
// persist (localStorage) so the dot doesn't reappear on every reload.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { BellIcon } from './icons';
import DuelOverlay from './DuelOverlay';
import ExecutionSlider from './ExecutionSlider';
import {
  useInteractions, notifyInteractionsChanged, interactionId,
  type Interaction,
} from '@/lib/useInteractions';

const SEEN_KEY = 'dishi_notif_seen';
const AUTO_KEY = 'dishi_duel_autosurfaced';
// Increased from 0.3 → 0.55 (2026-07-26) for better taste-learning refinement
// through pairwise contrast (duels are the only high-signal per-instance source).
const AUTO_PROB = 0.55;

function loadSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function saveSeen(ids: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids).slice(-50))); } catch { /* ignore */ }
}

export default function NotificationBell() {
  const { t, lang } = useLang();
  const path = usePathname();
  const { interactions, refresh } = useInteractions(path);
  const [listOpen, setListOpen] = useState(false);
  const [overlay, setOverlay] = useState<Interaction | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => (typeof window === 'undefined' ? new Set() : loadSeen()));

  const label = (n: Interaction) =>
    n.kind === 'duel' ? t('duel.title') : t('exec.title');
  const sub = (n: Interaction) => {
    if (n.kind === 'duel') return t(n.rematch ? 'notif.duel.rematch' : 'notif.duel.sub');
    // The execution item names its dish — "去邊度食" is answered by the card.
    const d = n.rows[n.rows.length - 1]?.dish;
    const name = (lang === 'zh' ? d?.name_zh : null) ?? d?.name ?? '';
    return t('notif.exec.sub').replace('{dish}', name);
  };

  const hasUnseen = interactions.some(n => !seen.has(interactionId(n)));

  function markAllSeen() {
    if (!interactions.length) return;
    const next = new Set(seen);
    for (const n of interactions) next.add(interactionId(n));
    setSeen(next); saveSeen(next);
  }

  function toggleList() {
    setListOpen(o => {
      const opening = !o;
      if (opening) markAllSeen(); // opening the list clears the dot
      return opening;
    });
  }

  // Rare once-per-session auto-surface of the top card if the user hasn't engaged.
  const top = interactions[0] ?? null;
  useEffect(() => {
    if (!top || overlay || listOpen) return;
    let already = false;
    try { already = sessionStorage.getItem(AUTO_KEY) === '1'; } catch { /* ignore */ }
    if (already) return;
    if (Math.random() < AUTO_PROB) {
      try { sessionStorage.setItem(AUTO_KEY, '1'); } catch { /* ignore */ }
      const timer = setTimeout(() => { setOverlay(top); markAllSeen(); }, 1400);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, overlay, listOpen]);

  return (
    <>
      <button className="notif-bell" onClick={toggleList} aria-label={t('notif.title')} aria-haspopup="menu" aria-expanded={listOpen}>
        <BellIcon size={20} />
        {hasUnseen && <span className="notif-dot" aria-hidden />}
      </button>

      {listOpen && (
        <>
          <div className="notif-scrim" onClick={() => setListOpen(false)} />
          <div className="notif-list" role="menu" aria-label={t('notif.title')}>
            {interactions.length === 0 ? (
              <div className="notif-empty">{t('notif.empty')}</div>
            ) : interactions.map(n => (
              <button key={interactionId(n)} className="notif-item" role="menuitem"
                onClick={() => { setOverlay(n); setListOpen(false); }}>
                <span className={`notif-item-seal${n.kind === 'duel' ? '' : ' ink'}`} aria-hidden>{n.kind === 'duel' ? '印' : '比'}</span>
                <span className="notif-item-text">
                  <span className="notif-item-label">{label(n)}</span>
                  <span className="notif-item-sub">{sub(n)}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {overlay?.kind === 'duel' && (
        <DuelOverlay
          duel={overlay.duel}
          rematch={overlay.rematch}
          onClose={(resolved) => {
            setOverlay(null);
            if (resolved) notifyInteractionsChanged(); // answered -> every surface re-syncs
          }}
        />
      )}
      {overlay?.kind === 'execution' && (
        <ExecutionSlider
          rows={overlay.rows}
          onDone={(scored) => {
            setOverlay(null);
            if (scored) notifyInteractionsChanged();
            else refresh.dismissExecution(); // session-local: returns another day, not today
          }}
        />
      )}
    </>
  );
}
