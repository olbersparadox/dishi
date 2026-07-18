'use client';
// Header notification bell — ALWAYS visible (a permanent affordance), built as a
// general notification slot. Today the only notification type is a waiting taste
// duel, but the list + seen-state are generic so more can be added without
// reworking this.
//
// Red dot = there is at least one notification the user hasn't looked at yet.
// Tapping the bell opens the list AND marks everything currently in it as seen, so
// the dot clears until a genuinely NEW notification (a new id) arrives. Seen ids
// persist (localStorage) so the dot doesn't reappear on every reload.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { BellIcon } from './icons';
import DuelOverlay, { type Duel } from './DuelOverlay';

const SEEN_KEY = 'dishi_notif_seen';
const AUTO_KEY = 'dishi_duel_autosurfaced';
const AUTO_PROB = 0.3;

type Notification = { id: string; label: string; sub: string; duel: Duel };

function loadSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function saveSeen(ids: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids).slice(-50))); } catch { /* ignore */ }
}

export default function NotificationBell() {
  const { t } = useLang();
  const path = usePathname();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [overlay, setOverlay] = useState<Duel | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => (typeof window === 'undefined' ? new Set() : loadSeen()));

  // Re-check for a waiting duel on mount and tab changes.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/duels/next')
      .then(r => r.json())
      .then(j => { if (!cancelled) setDuel(j.duel ?? null); })
      .catch(() => { /* no duel is a normal, silent state */ });
    return () => { cancelled = true; };
  }, [path]);

  const notifications: Notification[] = duel
    ? [{ id: `duel:${duel.id}`, label: t('duel.title'), sub: t('notif.duel.sub'), duel }]
    : [];
  const hasUnseen = notifications.some(n => !seen.has(n.id));

  function markAllSeen() {
    if (!notifications.length) return;
    const next = new Set(seen);
    for (const n of notifications) next.add(n.id);
    setSeen(next); saveSeen(next);
  }

  function toggleList() {
    setListOpen(o => {
      const opening = !o;
      if (opening) markAllSeen(); // opening the list clears the dot
      return opening;
    });
  }

  // Rare once-per-session auto-surface of the card if the user hasn't engaged.
  useEffect(() => {
    if (!duel || overlay || listOpen) return;
    let already = false;
    try { already = sessionStorage.getItem(AUTO_KEY) === '1'; } catch { /* ignore */ }
    if (already) return;
    if (Math.random() < AUTO_PROB) {
      try { sessionStorage.setItem(AUTO_KEY, '1'); } catch { /* ignore */ }
      const timer = setTimeout(() => { setOverlay(duel); markAllSeen(); }, 1400);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel, overlay, listOpen]);

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
            {notifications.length === 0 ? (
              <div className="notif-empty">{t('notif.empty')}</div>
            ) : notifications.map(n => (
              <button key={n.id} className="notif-item" role="menuitem"
                onClick={() => { setOverlay(n.duel); setListOpen(false); }}>
                <span className="notif-item-seal" aria-hidden>印</span>
                <span className="notif-item-text">
                  <span className="notif-item-label">{n.label}</span>
                  <span className="notif-item-sub">{n.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {overlay && (
        <DuelOverlay
          duel={overlay}
          onClose={(resolved) => {
            setOverlay(null);
            if (resolved) setDuel(null); // answered -> drop it; a dismiss keeps it
          }}
        />
      )}
    </>
  );
}
