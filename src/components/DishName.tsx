'use client';
import { useLang, pickNames } from '@/lib/i18n';

/**
 * The bilingual dish-name treatment:
 *   zh mode -> 麻婆豆腐 (big, bold) / Mapo tofu (small, thin, underneath)
 *   en mode -> Mapo tofu (big, bold) / 麻婆豆腐 (small, thin, underneath)
 * If only one language exists for a dish, it renders alone at primary size —
 * no fake translations, no empty slots.
 */
export default function DishName({
  name,
  name_zh,
  name_original,
  size = 'md',
  prefix,
}: {
  name: string;
  name_zh?: string | null;
  name_original?: string | null;
  size?: 'lg' | 'md';
  /** Rendered inline before the primary name at the same size/weight —
   * used for the rank ("1. ") in scan results per the design handoff. */
  prefix?: string;
}) {
  const { lang } = useLang();
  const { en, zh } = pickNames({ name, name_zh, name_original });

  const primary = lang === 'zh' ? (zh ?? en) : (en ?? zh);
  const secondary = lang === 'zh' ? (primary === zh ? en : undefined) : (primary === en ? zh : undefined);
  if (!primary) return null;

  return (
    <span className={`dishname ${size === 'lg' ? 'dishname-lg' : ''}`}>
      <span className="dishname-primary">{prefix}{primary}</span>
      {secondary && <span className="dishname-secondary">{secondary}</span>}
    </span>
  );
}
