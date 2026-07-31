'use client';
// The transient confirmation pill — "copied", and anything else the app needs to
// say without asking for a decision.
//
// This replaces window.alert(), which is what every copy confirmation in the app
// used to be (four call sites, all showing the same string). An alert is the
// wrong instrument for a confirmation: it BLOCKS, it needs dismissing, and its
// chrome is the browser's rather than the app's — a modal dialog for "5
// characters are on your clipboard" asks the person to acknowledge something
// they already know. A toast states it and leaves.
//
// One component, mounted by every surface that confirms a copy, so the journal's
// popup and the table bar's are the same popup rather than two that resemble
// each other (CLAUDE.md: reuse, don't imitate).
import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the pill stays. Long enough to read a short line, short enough that
 *  it is gone before anyone reaches to dismiss it. */
const DEFAULT_MS = 1900;

/** Owns the message and clears itself. Kept here beside the component so a
 *  caller wires a toast in two lines and cannot invent a fifth mechanism. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const onDone = useCallback(() => setMessage(null), []);
  return { message, onDone, show: setMessage };
}

export default function Toast({ message, onDone, ms = DEFAULT_MS }: {
  /** The line to show. Null renders nothing — the caller's state IS the trigger. */
  message: string | null;
  onDone: () => void;
  ms?: number;
}) {
  // onDone via ref, not in the dep array: callers pass a fresh closure on most
  // renders, and depending on it would restart the timer mid-life so a toast
  // could outstay its welcome (or never leave).
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => done.current(), ms);
    return () => clearTimeout(id);
  }, [message, ms]);

  if (!message) return null;
  // role=status + aria-live=polite: announced to a screen reader without
  // stealing focus, which is the accessible shape of "said, not asked".
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-pill">{message}</span>
    </div>
  );
}
