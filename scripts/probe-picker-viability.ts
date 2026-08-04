/**
 * Picker viability: would a TAPPABLE menu list have rescued these dishes?
 *
 * The adoption metric counts truth_on_list by normalized string equality, which
 * is the right bar for AUTO-adoption (the name is substituted unseen). It is the
 * wrong bar for a picker: a human reading 大爺燒鵝髀飯 taps it for their 燒鵝髀飯
 * without hesitating. So this re-asks the question a picker actually faces —
 * is the dish ON the menu at all, under any wording — and prints the list so the
 * owner can judge each case rather than trust a counter.
 */
import { createClient } from '@supabase/supabase-js';
import { fetchNameShortlist } from '../src/lib/nameShortlistFetch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const IDS = [
  '77691854', '48261c7b', '0cd43293', '4de03b0f', '0a1795fe',
  '924ae0fb', '1039fb09', 'a96d5a0f', '60a4be6c', '12420689',
];

(async () => {
  const { data: dishes } = await supabase
    .from('dishes').select('id, name_zh, lat, lng, eaten_at, created_at')
    .eq('user_id', '4d1c3ae0-47d9-4cba-b35e-179c134271bf');

  for (const prefix of IDS) {
    const d = (dishes ?? []).find((x: any) => x.id.startsWith(prefix));
    if (!d) { console.log(`${prefix}: dish not found\n`); continue; }
    const when = d.eaten_at ?? d.created_at;
    const r = await fetchNameShortlist(supabase, d.lat, d.lng, when);
    console.log(`\n=== ${d.name_zh}  (list=${r.shortlist.length}) ===`);
    console.log(r.shortlist.join(' | ') || '(empty)');
  }
})();
