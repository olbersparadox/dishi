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

// An execution ask dismissed with ✕ stays gone for THIS session and returns
// another day — the inbox must never nag the same card back within minutes,
// but a stranded comparison is still worth re-offering tomorrow.
const EXEC_DISMISS_KEY = 'dishi_exec_dismissed';
function execDismissed(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(EXEC_DISMISS_KEY) || '[]')); } catch { return new Set(); }
}

export function useInteractions(refetchKey?: string | null) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    fetch('/api/interactions/today')
      .then(r => r.json())
      .then(j => {
        if (cancelled || !Array.isArray(j?.interactions)) return;
        const dismissed = execDismissed();
        setInteractions((j.interactions as Interaction[]).filter(
          n => n.kind !== 'execution' || !dismissed.has(interactionId(n)),
        ));
      })
      .catch(() => { /* nothing waiting is a normal, silent state */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load, refetchKey]);
  useEffect(() => {
    const on = () => load();
    window.addEventListener(CHANGED_EVENT, on);
    return () => window.removeEventListener(CHANGED_EVENT, on);
  }, [load]);

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
