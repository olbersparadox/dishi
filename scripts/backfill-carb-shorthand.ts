/**
 * One-off, MANUAL backfill for HK carb-shorthand integrity (backlog item #4c, extended
 * by the honest-vector-re-score follow-up). NOT a cron — run by hand after a fix
 * deploys, then forget it.
 *
 * What it does: runs the `carbSuspicion` tripwire the live scan/enrich path now uses
 * over already-stored rows, and re-derives ONLY the suspicious subset. That bound
 * matters — re-deriving every dish would be an unbounded LLM bill; the tripwire is
 * exactly how we spend tokens only where a carb looks misread (the 炆米→炆飯 rows).
 * Prints before/after so the run is auditable.
 *
 * SCOPE (the follow-up closed the gaps the first run deliberately left):
 *   • enrichment fields (diet / cooking_method / heaviness) — as before.
 *   • the ENGLISH NAME — re-authored via the translate path WITH the shorthand
 *     glossary, but ONLY where the authority ladder allows a machine to
 *     (canReauthorEnName: never a human-edited name, never an identity-linked dish,
 *     and only with a CJK zh seed to re-translate FROM). The zh name is NEVER
 *     touched — it may be the printed original.
 *   • the 18-dim ATTRIBUTE VECTOR — re-scored AFTER the name work, grounded in the
 *     corrected ingredient list + the carb recheck line (the same honest-re-score
 *     the live /api/dishes/enrich path now performs on a tripwire fire).
 *   • affected owners' taste profiles — REPLAYED once per user at the end, so
 *     ratings that learned from a polluted vector heal (same mechanism as a re-rate).
 *
 * RUN:
 *   Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OPENROUTER_API_KEY
 *   are in the environment (e.g. `set -a; source .env.local; set +a`), then:
 *     npx tsx scripts/backfill-carb-shorthand.ts            # dry run: report only
 *     npx tsx scripts/backfill-carb-shorthand.ts --apply    # write corrections + replay
 */
import { supabaseAdmin } from '../src/lib/supabase/server';
import { carbSuspicion, enrichOneDish, scoreOneDish, HK_MENU_SHORTHAND_GUIDANCE } from '../src/lib/menuScan';
import { canReauthorEnName } from '../src/lib/dishIdentity';
import { translateDishName } from '../src/lib/translate';
import { replayProfile } from '../src/lib/replay';

const APPLY = process.argv.includes('--apply');

type DishRow = {
  id: string; user_id: string; name: string | null; name_zh: string | null; cuisine: string | null;
  diet: string[] | null; cooking_method: string | null; heaviness: string | null;
  attributes: Record<string, number> | null;
  name_edited_at: string | null; dish_identity_id: string | null;
};

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required — re-derivation needs a real model call.');
  }
  const admin = supabaseAdmin();

  // No persisted ingredients, so the tripwire runs on names alone — its English-name
  // fallback (see carbSuspicion) is precisely the signal that survives on stored rows.
  const { data, error } = await admin
    .from('dishes')
    .select('id, user_id, name, name_zh, cuisine, diet, cooking_method, heaviness, attributes, name_edited_at, dish_identity_id');
  if (error) throw error;
  const rows = (data ?? []) as DishRow[];

  const suspicious = rows.filter(r => carbSuspicion(r.name, r.name_zh, []));
  console.log(`dishes scanned: ${rows.length}`);
  console.log(`suspicious (carb tripwire fired): ${suspicious.length}`);
  if (!APPLY) {
    for (const r of suspicious) {
      const nameFix = canReauthorEnName(r) ? 'would re-author EN name' : 'name LOCKED (human/identity/no zh seed)';
      console.log(`  would fix: ${r.name_zh || r.name}  (en: "${r.name}") — diet: [${(r.diet ?? []).join(', ')}] — ${nameFix}, would re-score vector`);
    }
    console.log('\nDRY RUN — re-run with --apply to write corrections and replay affected profiles.');
    return;
  }

  let changed = 0;
  const affectedUsers = new Set<string>();
  for (const r of suspicious) {
    // Prefer the Chinese name as the seed: the shorthand lives there, and the enrich
    // prompt's glossary + the carb re-ask now expand it (米→米粉) before deriving.
    const seed = r.name_zh || r.name;
    if (!seed) continue;
    const enriched = await enrichOneDish({ name: seed, name_zh: r.name_zh, cuisine: r.cuisine || 'unknown' });

    // Name FIRST (the honest ordering: the vector re-score below reasons from the
    // corrected reading), ladder-guarded — see canReauthorEnName's rationale.
    let newName: string | null = null;
    if (canReauthorEnName(r)) {
      newName = await translateDishName(r.name_zh!, { guidance: HK_MENU_SHORTHAND_GUIDANCE }).catch(() => null);
      if (newName && newName.trim() === (r.name ?? '').trim()) newName = null; // unchanged — don't churn the row
    }

    // Vector second, grounded in the corrected ingredients + the recheck line —
    // the same composition the live enrich route uses on a fire.
    const rescored = await scoreOneDish(
      { name: newName ?? r.name ?? seed, name_zh: r.name_zh, cuisine: r.cuisine || 'unknown' },
      { groundIngredients: enriched.ingredients, carbRecheck: true },
    ).catch(() => null);

    const update: Record<string, unknown> = {
      diet: enriched.diet, cooking_method: enriched.cooking_method, heaviness: enriched.heaviness,
    };
    // A failed/empty re-score must not wipe a real vector with nothing (same
    // protection the enrich route's force mode uses).
    if (rescored && Object.keys(rescored).length > 0) update.attributes = rescored;
    // Machine re-author of a machine-derived EN name — name_edited_at deliberately
    // untouched (this is not a human edit and must never masquerade as one).
    if (newName) update.name = newName;

    const { error: upErr } = await admin.from('dishes').update(update).eq('id', r.id);
    if (upErr) { console.error(`  FAILED ${r.id}: ${upErr.message}`); continue; }
    changed++;
    affectedUsers.add(r.user_id);
    const nameNote = newName ? ` name: "${r.name}" -> "${newName}"` : (canReauthorEnName(r) ? '' : ' (name locked)');
    console.log(`  fixed ${r.name_zh || r.name}: diet [${(r.diet ?? []).join(',')}] -> [${enriched.diet.join(',')}]${update.attributes ? ' + vector re-scored' : ''}${nameNote}`);
  }

  // Heal every affected owner's profile ONCE — their ratings may have learned from
  // the polluted vectors. Replay is the same mechanism a re-rate uses; rating_count
  // is never touched (see /api/dishes/enrich for the same pattern).
  for (const userId of Array.from(affectedUsers)) { // Array.from, not spread — bare-tsc downlevelIteration
    const rebuilt = await replayProfile(admin, userId).catch(() => null);
    if (!rebuilt) { console.error(`  replay FAILED for user ${userId}`); continue; }
    const { error: rpErr } = await admin.from('taste_profiles').upsert({
      user_id: userId,
      vector: rebuilt.vector,
      cuisine_affinity: rebuilt.cuisine_affinity,
      evidence: rebuilt.evidence,
      updated_at: new Date().toISOString(),
    });
    if (rpErr) console.error(`  replay write FAILED for user ${userId}: ${rpErr.message}`);
    else console.log(`  replayed profile for user ${userId}`);
  }

  console.log(`\nrows corrected: ${changed} / ${suspicious.length} suspicious; profiles replayed: ${affectedUsers.size}`);
}

main().catch(e => { console.error(e); process.exit(1); });
