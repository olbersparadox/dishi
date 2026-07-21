'use client';
// The ranked-list row — ONE render, shared by /scan's settled results and /table's
// session view. The Table Mode "one shared surface" regression (a second,
// look-alike list built to imitate this one instead of importing it) happened
// because nothing forced a single implementation to exist. This file is that
// single implementation — every caller renders exactly this, never a restyled
// copy of it.
import DishName from './DishName';
import DishInfoDisplay from './DishInfoDisplay';
import { SpeechIcon } from './icons';
import { useLang, type LangCode, type LangPair } from '@/lib/i18n';

export type DishListRowItem = {
  key: string;
  name: string;
  name_zh?: string | null;
  name_original?: string | null;
  price?: string | null;
  cooking_method?: string | null;
  heaviness?: string | null;
  diet?: string[] | null;
  ingredients?: string[] | null;
  /** Chips/hook render once true (Stage-2 enrichment landed on scan's side; a
   * table candidate that already carries diet/ingredient data should just pass
   * true — there's no separate enrichment wait on that path). Before that a
   * shimmer placeholder holds the row's height so it doesn't jump. */
  enriched?: boolean;
  /** "加咗一頁" tag — a scan-only concept (an appended menu page). Table
   * candidates never set this. */
  isNew?: boolean;
};

export type FireFor = { userId: string; color: string };

export default function DishListRow({
  item, rank, picked, onSelect, pickedBy, stamps, fire = false, reason, fireFor, pair, menuLanguage,
}: {
  item: DishListRowItem;
  rank: number;
  picked: boolean;
  onSelect: () => void;
  /** Names for the 「{name} 也選了」 line. */
  pickedBy?: string[];
  /** Chop-avatar slot — table-only; scan never passes this. */
  stamps?: React.ReactNode;
  /** The single earned-mark claim (see scan/page.tsx's own settled-list
   * philosophy note). Only ever set by scan's own SOLO ranking — a group of
   * people don't share one person's personal match, and the stamps themselves
   * already carry "this landed with people." Table never passes this. */
  fire?: boolean;
  reason?: string | null;
  /** Table-only, per-member equivalent of `fire`: one small 🔥 badge per member
   * this dish is genuinely recommended for, dotted in THEIR OWN chop color —
   * the same visual grammar as the AI-sparkle badge on the header globe (owner
   * request, 2026-07-21). Distinct from `stamps` (who has ACTUALLY picked this)
   * — this is "who it's predicted to suit," shown even before anyone picks. */
  fireFor?: FireFor[];
  pair?: LangPair;
  menuLanguage?: LangCode | null;
}) {
  const { t } = useLang();
  return (
    <article
      className={`card scan-pickable scan-settle-row ${fire ? 'scan-hero' : ''} ${picked ? 'picked' : ''}`}
      onClick={onSelect}
    >
      <div className="card-body">
        <div className="scan-item">
          <span className="scan-rank">{rank}.</span>
          <div className="scan-item-main">
            <div className="dish-row">
              <div className="card-title" style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                <DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original ?? undefined}
                  pair={pair} menuLanguage={menuLanguage}
                  suffix={
                    fire ? <span className="scan-fire scan-fire-pop" aria-label={t('scan.fire')}>{'🔥'}</span>
                    : fireFor?.length ? (
                      // Right of the PRIMARY name specifically (owner request,
                      // 2026-07-21) — DishName renders `suffix` inside its own
                      // primary span, the exact same slot scan's single fire uses,
                      // so table's per-member fire follows scan's own treatment
                      // rather than trailing the whole title block.
                      <>
                        {fireFor.map(f => (
                          <span key={f.userId} className="fire-dot-badge" aria-hidden>
                            {'🔥'}
                            <span className="fire-dot" style={{ background: f.color }} />
                          </span>
                        ))}
                      </>
                    ) : undefined
                  } />
                {item.isNew && <span className="scan-new-tag">{t('scan.new')}</span>}
              </div>
              {/* Price + stamps share the right column, price above stamps —
                  right-aligned with each other rather than stamps sitting full-
                  width under the whole row (owner request, 2026-07-21). */}
              {(item.price || stamps) && (
                <div className="dish-row-right">
                  {item.price && <span className="dish-price">{item.price}</span>}
                  {stamps}
                </div>
              )}
            </div>
            {item.enriched && <DishInfoDisplay info={item} hookOnly />}
          </div>
        </div>
        {item.enriched ? (
          <div className="fade-in">
            <DishInfoDisplay info={item} hideHook />
            {!!pickedBy?.length && (
              <div className="card-meta" style={{ color: 'var(--ink)', fontWeight: 600, marginTop: 2 }}>
                {t('scan.share.alsopicked', { handles: pickedBy.join('、') })}
              </div>
            )}
          </div>
        ) : (
          <div className="hook-shimmer" aria-hidden />
        )}
        {fire && reason && (
          <p className="scan-reason fade-in">
            <span className="scan-reason-icon" aria-hidden><SpeechIcon size={18} /></span>
            <span>{reason}</span>
          </p>
        )}
      </div>
    </article>
  );
}
