'use client';
// The client half of /api/interactions/today — one hook, consumed by BOTH host
// surfaces (the notification bell and the journal's daily cards), so they can
// never drift apart: answering an interaction on either surface fires one
// window event and every consumer refetches. State deliberately lives in the
// endpoint, not here — this hook only mirrors it.
import { useCallback, useEffect, useState } from 'react';
import type { Duel } from '@/components/DuelOverlay';
import type { ExecutionRow } from '@/components/ExecutionSlider';

export type Interaction =
  | { kind: 'duel'; duel: Duel; rematch: boolean }
  | { kind: 'execution'; rows: ExecutionRow[] };

/** Stable id for seen-tracking and list keys. */
export function interactionId(n: Interaction): string {
  return n.kind === 'duel'
    ? `duel:${n.duel.id}`
    : `exec:${n.rows.map(r => r.dish.id).join('|')}`;
}

const CHANGED_EVENT = 'dishi:interactions-changed';
/** Call after answering an interaction anywhere — every surface refetches. */
export function notifyInteractionsChanged() {
  try { window.dispatchEvent(new Event(CHANGED_EVENT)); } catch { /* ignore */ }
}

// ONE request per load, shared by every consumer (bug fix 2026-08-05).
//
// This endpoint is NOT a pure read: when the duel cooldown has passed it SEALS
// A PREDICTION AND INSERTS a dish_duels row. Both host surfaces mount this hook
// (NotificationBell + DailyInteractions), so every page load fired two GETs
// ~2ms apart; both saw "no open duel", both passed the cooldown, both ran the
// DETERMINISTIC selection and got the same pair, and both inserted. The user
// answered one row, and the duplicate — still open, still < 24h — was then
// resumed by the pending branch as the SAME two dishes. Observed live twice
// (rows 162ms and 526ms apart, 2026-07-31 and 2026-08-02, each answered twice,
// so one comparison taught the engine twice).
//
// Two distinct intents, deliberately NOT the same call:
//   join()    — "show me what's waiting" (a surface mounting). Riding an
//               in-flight request is exactly right; it must never cause a
//               second one, which is the whole point of this fix.
//   refresh() — "state changed on the server, get it again" (an interaction was
//               just answered). If one is already in flight it may be reading
//               pre-answer state, so a follow-up is QUEUED rather than dropped,
//               or a resolved duel would linger on screen.
let inFlight: Promise<Interaction[]> | null = null;
let refetchQueued = false;

function start(): Promise<Interaction[]> {
  inFlight = fetch('/api/interactions/today')
    .then(r => r.json())
    .then(j => (Array.isArray(j?.interactions) ? (j.interactions as Interaction[]) : []))
    .catch(() => [])   // nothing waiting is a normal, silent state
    .then(list => {
      inFlight = null;
      if (refetchQueued) { refetchQueued = false; return start(); }
      return list;
    });
  return inFlight;
}

function join(): Promise<Interaction[]> {
  return inFlight ?? start();
}

function refresh(): Promise<Interaction[]> {
  if (inFlight) { refetchQueued = true; return inFlight; }
  return start();
}

// An execution ask dismissed with ✕ stays gone for THIS session and returns
// another day — the inbox must never nag the same card back within minutes,
// but a stranded comparison is still worth re-offering tomorrow.
const EXEC_DISMISS_KEY = 'dishi_exec_dismissed';
function execDismissed(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(EXEC_DISMISS_KEY) || '[]')); } catch { return new Set(); }
}

export function useInteractions(refetchKey?: string | null) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const apply = useCallback((run: () => Promise<Interaction[]>) => {
    let cancelled = false;
    run().then(list => {
      if (cancelled) return;
      const dismissed = execDismissed();
      setInteractions(list.filter(
        n => n.kind !== 'execution' || !dismissed.has(interactionId(n)),
      ));
    });
    return () => { cancelled = true; };
  }, []);

  // Mounting JOINS an in-flight request; only a change notification forces a
  // fresh one. See the note on join/refresh above — a second surface mounting
  // must not trigger a second GET, because that GET inserts a duel.
  const load = useCallback(() => apply(join), [apply]);

  useEffect(() => load(), [load, refetchKey]);
  useEffect(() => {
    const on = () => apply(refresh);
    window.addEventListener(CHANGED_EVENT, on);
    return () => window.removeEventListener(CHANGED_EVENT, on);
  }, [apply]);

  const dismissExecution = useCallback(() => {
    setInteractions(cur => {
      const exec = cur.find(n => n.kind === 'execution');
      if (exec) {
        try {
          const next = Array.from(execDismissed().add(interactionId(exec))).slice(-20);
          sessionStorage.setItem(EXEC_DISMISS_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
      }
      return cur.filter(n => n.kind !== 'execution');
    });
    notifyInteractionsChanged();
  }, []);

  return { interactions, refresh: { load, dismissExecution } };
}
