/**
 * Recovers as many COMPLETE objects as possible from a truncated JSON response —
 * specifically the case where a model's output got cut off mid-array because it
 * ran out of its token budget. Normal JSON.parse throws on the whole string the
 * moment anything is malformed; this instead walks the array by hand, keeping
 * every object that closed cleanly and stopping at the first one that didn't.
 *
 * This turns "menu had 50 dishes, response got cut off at dish 38, scan returns
 * ZERO items" into "scan returns the 37 dishes that were actually complete" — a
 * genuinely usable partial result instead of a total, silent failure.
 *
 * Deliberately conservative: only ever returns objects it's sure parsed correctly.
 * Never guesses at what a broken object "probably" meant.
 */
export function salvageJsonObjects(raw: string, arrayKey: string): any[] {
  const keyMarker = `"${arrayKey}"`;
  const keyIdx = raw.indexOf(keyMarker);
  if (keyIdx === -1) return [];

  const arrayStart = raw.indexOf('[', keyIdx);
  if (arrayStart === -1) return [];

  const results: any[] = [];
  let i = arrayStart + 1;

  while (i < raw.length) {
    // Skip whitespace/commas between objects.
    while (i < raw.length && /[\s,]/.test(raw[i])) i++;
    if (raw[i] === ']' || i >= raw.length) break; // clean end, or ran off the string
    if (raw[i] !== '{') break; // anything else here means the structure is already broken

    // Walk forward tracking brace depth and string state to find this object's end.
    let depth = 0;
    let inString = false;
    let escaped = false;
    const objStart = i;
    let objEnd = -1;

    for (; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { objEnd = i; break; }
      }
    }

    if (objEnd === -1) break; // this object never closed — truncation point found, stop here

    const candidate = raw.slice(objStart, objEnd + 1);
    try {
      results.push(JSON.parse(candidate));
    } catch {
      break; // closed its braces but still isn't valid JSON — stop rather than guess
    }
    i = objEnd + 1;
  }

  return results;
}
