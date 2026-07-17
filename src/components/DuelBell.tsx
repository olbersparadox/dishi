'use client';
// Header notification bell. Currently a single notification type — a waiting taste
// duel — but built as a general slot so more can live here later. The bell only
// appears when there's actually something to show (so it's never a dead affordance,
// and never shows on the signed-out screen, where /api/duels/next just 401s). A dot
// marks that a duel is waiting; tapping opens the floating card. If the user never
// taps, it also auto-surfaces occasionally (rare, at most once per session) — the
// server's ~20h spacing already limits how often a new duel even exists.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BellIcon } from './icons';
import DuelOverlay, { type Duel } from './DuelOverlay';

const AUTO_SURFACE_PROB = 0.35;
const AUTO_SURFACE_KEY = 'dishi_duel_autosurfaced';

export default function DuelBell() {
  const path = usePathname();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [open, setOpen] = useState(false);

  // Re-check availability on mount and whenever the user changes tabs — cheap, and
  // it catches a duel that became available while the app stayed open.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/duels/next')
      .then(r => r.json())
      .then(j => { if (!cancelled) setDuel(j.duel ?? null); })
      .catch(() => { /* no duel is a normal, silent state */ });
    return () => { cancelled = true; };
  }, [path]);

  // Rare, once-per-session auto-surface if the user hasn't opened it themselves.
  useEffect(() => {
    if (!duel || open) return;
    let already = false;
    try { already = sessionStorage.getItem(AUTO_SURFACE_KEY) === '1'; } catch { /* ignore */ }
    if (already) return;
    if (Math.random() < AUTO_SURFACE_PROB) {
      try { sessionStorage.setItem(AUTO_SURFACE_KEY, '1'); } catch { /* ignore */ }
      const timer = setTimeout(() => setOpen(true), 1400);
      return () => clearTimeout(timer);
    }
  }, [duel, open]);

  if (!duel) return null;

  return (
    <>
      <button className="duel-bell" onClick={() => setOpen(true)} aria-label="Taste duel" aria-haspopup="dialog">
        <BellIcon size={20} />
        <span className="duel-bell-dot" aria-hidden />
      </button>
      {open && (
        <DuelOverlay
          duel={duel}
          onClose={() => {
            setOpen(false);
            // Clearing it hides the bell after a resolution; a dismiss ("not now")
            // re-fetches on the next tab change and the bell returns.
            setDuel(null);
          }}
        />
      )}
    </>
  );
}
