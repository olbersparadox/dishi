// One share path for the whole app.
//
// This existed TWICE before the sharing batch — scan/page.tsx's copyTableLink
// and table/page.tsx's share — near-identical and quietly disagreeing about
// the most important case: what happens when the person DISMISSES the OS
// share sheet. scan treated a dismissal as "done, say nothing"; table let it
// fall through to the clipboard, so backing out of the sheet silently copied
// a link and popped an alert about it. Cancelling should cancel.
//
// The distinction the platform gives us is `AbortError`, which is what a
// dismissal throws. Anything else out of navigator.share is a real failure
// (no handler for the payload, blocked outside a user gesture) and SHOULD
// fall back to the clipboard, because in that case the person still wants
// the link and just can't have the sheet.
//
// Returns a result instead of showing UI: the two table call sites alert(),
// but the sharing surfaces want quieter feedback, and a lib that reaches for
// alert() can't be used by either without lying to one of them.

export type ShareResult =
  /** Handed to the OS share sheet. */
  | 'shared'
  /** No share sheet available (desktop, mostly) — the URL is on the clipboard. */
  | 'copied'
  /** The person dismissed the sheet. Not an error; show nothing. */
  | 'cancelled'
  /** Neither channel worked — the caller should surface something. */
  | 'failed';

export type SharePayload = {
  url: string;
  title?: string;
  /** Rides in the message body ahead of the URL. Carries the verdict on a
   * dish share — a dish sent with no verdict reads as a recommendation of it,
   * the same reason the card itself must always print the word. */
  text?: string;
};

/** True when this browser can hand `payload` to an OS share sheet. `canShare`
 *  is consulted when present because Safari exposes `share` but rejects some
 *  payloads at call time; asking first turns that into a clean fallback
 *  rather than a thrown error we'd have to classify. */
function canUseShareSheet(payload: SharePayload): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare(payload);
    } catch {
      return false;
    }
  }
  return true;
}

async function copyToClipboard(url: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Insecure context, or permission refused. Not recoverable here.
    return false;
  }
}

/**
 * Share a URL: OS sheet first, clipboard second.
 *
 * Must be called from a user gesture — every browser requires one for both
 * channels, and losing the gesture (by awaiting something first) is the usual
 * cause of a share that works in dev and fails on a real phone.
 */
export async function shareLink(payload: SharePayload): Promise<ShareResult> {
  if (canUseShareSheet(payload)) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (e) {
      // A dismissal is the person's answer, not a failure to route around.
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      // Anything else: the sheet couldn't take it, so fall through and at
      // least get the link into their hands.
    }
  }
  return (await copyToClipboard(payload.url)) ? 'copied' : 'failed';
}
