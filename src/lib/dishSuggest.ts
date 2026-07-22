// Pure ranking/merge logic behind /api/dishes/suggest (打字 quick-add, backlog
// 2026-07-22 item 3). Kept out of the route so the tiering rule is testable
// without a database: nearby-restaurant dish_identities outrank the person's
// own history, because a name someone else already logged at the place you're
// standing in is a stronger guess than your own unrelated dish history. No
// third "generic completion" tier — Dishi has no browsable dish dictionary
// beyond what someone has actually logged.

export type SuggestRow = { name: string; name_zh: string | null; restaurant_id?: string | null };

/** Dedupe by (name, name_zh) pair, preserving the order rows are pushed in —
 * callers push nearby-identity rows first, then the person's own history, so
 * first-seen-wins already encodes the tier priority. */
export function mergeSuggestions(tiers: SuggestRow[][], cap = 8): SuggestRow[] {
  const seen = new Set<string>();
  const out: SuggestRow[] = [];
  for (const rows of tiers) {
    for (const r of rows) {
      const name = (r.name ?? '').trim();
      const nameZh = (r.name_zh ?? '').trim();
      if (!name && !nameZh) continue;
      const key = `${name}|${nameZh}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, name_zh: nameZh || null, restaurant_id: r.restaurant_id ?? null });
      if (out.length >= cap) return out;
    }
  }
  return out;
}
