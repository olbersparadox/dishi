// Owner-menu authority reconciliation — gate that lets a restaurant OWNER's own
// published menu names win over diner-side names (see the AUTHORITY_OWNER tier and
// ownerMenuExactMatch in dishIdentity.ts for why the owner outranks even a menu scan).
//
// Two entry paths, two confidence bars, one shared rule (only ever UPGRADE a
// dish_identity to AUTHORITY_OWNER; never downgrade or rename away from an equal or
// higher claim):
//
//   • Diner links a dish (identity confirm route): synchronous, EXACT match only.
//     Cheap, zero-risk, no API call in the diner's request path. If their dish is
//     spelled exactly like an owner item, it adopts the owner's canonical name now.
//
//   • Owner publishes/edits their menu (menu route): the owner's list is
//     authoritative and the owner just typed it, so this path may also resolve
//     FUZZY matches (蝦餃 ↔ the owner's 水晶鮮蝦餃) through the same LLM adjudicator
//     diners' identity resolution uses — but WITHOUT a human confirm gate, because
//     the human (the owner) already authored the authoritative name. The adjudicator
//     still fails closed and only accepts high-confidence verdicts, so a wrong merge
//     stays the thing it's designed to avoid.
//
// Typed loosely on the client like restaurant.ts: pass a supabaseAdmin() client —
// dish_identities belong to diners, so owner-scoped RLS can't update them.

import {
  candidateMatches, ownerMenuExactMatch, AUTHORITY_OWNER,
  type DishLike, type OwnerMenuLike,
} from './dishIdentity';
import { adjudicateSameDish } from './dishMatch';

type Identity = { id: string; name: string; name_zh: string | null; name_authority: number | null };

/**
 * Keeps every dish row that belongs to an identity carrying the identity's ONE
 * canonical name. Called whenever the canonical name changes (a link, an owner
 * adopt, an owner rename). Not a human edit — name_edited_at is deliberately left
 * untouched, so this never demotes a menu-scan name to the human tier. Once a dish
 * is linked, its stored name is governed here, and the UI stops offering to edit it.
 */
export async function propagateIdentityNameToDishes(
  admin: any, identityId: string, name: string, nameZh: string | null,
): Promise<void> {
  await admin.from('dishes').update({ name, name_zh: nameZh ?? null }).eq('dish_identity_id', identityId);
}

// A menu can be large; the LLM path is only taken for identities that (a) exist at
// this restaurant, (b) aren't already owner-authoritative, and (c) had no exact hit.
// In practice that's a handful. This hard cap stops a pathological restaurant from
// firing dozens of adjudications in one publish.
const MAX_LLM_RECONCILE = 12;

export async function applyOwnerMenuAuthority(
  admin: any,
  restaurantId: string,
  opts: { useLLM?: boolean; restaurantName?: string | null; onlyIdentityId?: string } = {},
): Promise<{ upgraded: number }> {
  const { data: itemsRaw } = await admin
    .from('restaurant_menu_items')
    .select('id, name, name_zh')
    .eq('restaurant_id', restaurantId)
    .eq('available', true);
  const items: OwnerMenuLike[] = itemsRaw ?? [];
  if (items.length === 0) return { upgraded: 0 };

  let q = admin
    .from('dish_identities')
    .select('id, name, name_zh, name_authority')
    .eq('restaurant_id', restaurantId);
  if (opts.onlyIdentityId) q = q.eq('id', opts.onlyIdentityId);
  const { data: identsRaw } = await q;
  const idents: Identity[] = identsRaw ?? [];
  if (idents.length === 0) return { upgraded: 0 };

  let upgraded = 0;
  let llmBudget = MAX_LLM_RECONCILE;

  for (const ident of idents) {
    // Already at (or above, defensively) owner authority — the owner's name is
    // already canonical here, nothing to do.
    if ((ident.name_authority ?? 0) >= AUTHORITY_OWNER) continue;

    let match: OwnerMenuLike | null = ownerMenuExactMatch(ident, items);

    if (!match && opts.useLLM && llmBudget > 0) {
      const target: DishLike = { id: ident.id, name: ident.name, name_zh: ident.name_zh };
      // Owner items reduced to DishLike so the SAME gate-1 prefilter + gate-2
      // adjudicator that resolve diner-vs-diner names can resolve diner-vs-owner.
      const pool: DishLike[] = items.map(i => ({ id: i.id, name: i.name, name_zh: i.name_zh }));
      const candidates = candidateMatches(target, pool);
      if (candidates.length > 0) {
        llmBudget--;
        const [winner] = await adjudicateSameDish(target, candidates, opts.restaurantName ?? null);
        if (winner) match = items.find(i => i.id === winner.id) ?? null;
      }
    }

    if (match) {
      await admin
        .from('dish_identities')
        .update({
          name: match.name,
          name_zh: match.name_zh ?? null,
          name_authority: AUTHORITY_OWNER,
          owner_menu_item_id: match.id, // remember the source, so a later rename can follow
        })
        .eq('id', ident.id);
      // Push the owner's canonical name down onto every linked dish row.
      await propagateIdentityNameToDishes(admin, ident.id, match.name, match.name_zh ?? null);
      upgraded++;
    }
  }

  return { upgraded };
}
