/**
 * One-off, MANUAL backfill of `taste_profiles.domain_evidence` — 墨靈 phase 2
 * (docs/rnd/mokling-framework.md ship path, docs/BACKLOG.md item 2), approved
 * by the owner 2026-08-04. NOT a cron. Run once by hand, confirm, then forget it.
 *
 * WHY: `domain_evidence` was added 2026-08-04 and is written going forward by
 * every rating/re-rate/rename path (see replay.ts, ratings/route.ts and
 * friends). But it only ACCUMULATES on new activity — a profile with rating
 * history from before the column existed has a domain_evidence that reflects
 * only whatever the person rated tonight, not their full history. Confirmed
 * live: the owner's own row read {air:0.39, land:0.39, sub:{land:{pork:0.78}}}
 * (one dish's worth) while a fresh replayProfile() over their real 60-dish
 * history computes sea 31.7% / land 22.3% / shell 20.3% / … — a materially
 * different, much richer creature. Every other profile is in the same state.
 *
 * WHAT IT WRITES: `domain_evidence`, and nothing else. Deliberately narrow,
 * same discipline as backfill-ingredients.ts. `replayProfile()` also returns
 * vector/evidence/cuisine_affinity, but those are ALREADY correct — they were
 * being written incrementally since day one, long before this column existed —
 * so touching them here would be scope creep with no upside and a real risk of
 * introducing float-ordering drift into fields that work today. This script
 * must never widen.
 *
 * HOW: `replayProfile()` — the SAME function every re-rate/rename already
 * trusts to rebuild the profile from ratings history. No LLM calls, no new
 * logic: pure computation over data already in the database. Overwrites
 * domain_evidence UNCONDITIONALLY (not just when empty) because replay is
 * designed to be authoritative — it supersedes incremental accumulation by
 * construction (same as vector already does on every re-rate).
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/backfill-domain-evidence.ts            # dry run: report only
 *   npx tsx scripts/backfill-domain-evidence.ts --apply    # write
 */
import { supabaseAdmin } from '../src/lib/supabase/server';
import { replayProfile } from '../src/lib/replay';
import type { DomainEvidence } from '../src/lib/creatureForm';

const APPLY = process.argv.includes('--apply');

/** Deep-equal on plain JSON values, key-order independent. Needed because
 *  Postgres jsonb does NOT preserve insertion order on round-trip (confirmed
 *  live: the same record came back {air,sea,sub,land,...} vs the fresh
 *  object's {sea,land,air,...}), so a naive JSON.stringify(a)===JSON.stringify(b)
 *  reported every row as "changed" even when the values were identical —
 *  cosmetically wrong and would have made every future re-run of this script
 *  claim work that wasn't there. */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ak = Object.keys(a as object).sort(), bk = Object.keys(b as object).sort();
  if (ak.length !== bk.length) return false;
  return ak.every((k, i) => k === bk[i] && jsonEqual((a as any)[k], (b as any)[k]));
}

function summarize(ev: DomainEvidence): string {
  const keys = ['sea', 'land', 'air', 'shell', 'field', 'algae', 'fungus'] as const;
  const parts = keys
    .map(k => [k, ev[k] ?? 0] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v.toFixed(2)}`);
  return parts.length ? parts.join(' ') : '(empty)';
}

async function main() {
  const admin = supabaseAdmin();

  const { data: profiles, error } = await admin
    .from('taste_profiles')
    .select('user_id, rating_count, domain_evidence');
  if (error) throw error;

  const rows = profiles ?? [];
  console.log(`taste_profiles rows:  ${rows.length}`);
  console.log(`mode:                 ${APPLY ? 'APPLY (writes)' : 'DRY RUN'}\n`);

  let written = 0, wouldWrite = 0, unchanged = 0, empty = 0, failed = 0;

  for (const row of rows) {
    const before = (row.domain_evidence ?? {}) as DomainEvidence;
    // replayProfile takes a SupabaseClient; admin bypasses RLS the same way
    // replay's own dish_duels read already does for this exact reason.
    const rebuilt = await replayProfile(admin as any, row.user_id);
    if (!rebuilt) {
      console.log(`  FAILED replay: ${row.user_id}`);
      failed++; continue;
    }
    const after = rebuilt.domain_evidence;
    const beforeStr = summarize(before), afterStr = summarize(after);

    if (jsonEqual(before, after)) {
      if (afterStr === '(empty)') empty++; else unchanged++;
      console.log(`  ${row.user_id.slice(0, 8)} unchanged (${rebuilt.replayed} ratings): ${afterStr}`);
      continue;
    }

    console.log(`  ${row.user_id.slice(0, 8)} (${rebuilt.replayed} ratings):`);
    console.log(`    before: ${beforeStr}`);
    console.log(`    after:  ${afterStr}`);

    if (!APPLY) { wouldWrite++; continue; }

    const { error: upErr } = await admin
      .from('taste_profiles')
      .update({ domain_evidence: after })
      .eq('user_id', row.user_id);
    if (upErr) { console.error(`    FAILED write: ${upErr.message}`); failed++; continue; }
    written++;
  }

  console.log(`\n${APPLY ? `written: ${written}` : `would write: ${wouldWrite}`}   unchanged: ${unchanged}   no domain evidence: ${empty}   failed: ${failed}`);
  if (!APPLY) console.log('\nDRY RUN — re-run with --apply to write.');
  console.log('Re-run is safe: replay is deterministic, so a second run computes the same result.');
}

main().catch(e => { console.error(e); process.exit(1); });
