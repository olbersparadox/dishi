'use client';
// The reward + light review, MERGED (rating flow). You land here after flick-rating an
// album and WATCH your Taste AI learn — each dish's REAL data streams in (bilingual name
// → diet/ingredient icon chips → nearby restaurants). Learned qualities FLY INTO the ink
// blob and grow it. REFINING is rewarded: pick the right restaurant or fix a name and the
// bar + blob respond. The bar reads REAL taste-engine confidence (/api/buddy), never a
// raw count, so growth is honest.
//
// RatingStack owns the pipeline + persistence and streams each card's state in via `live`;
// this component renders it and reports refinements back through callbacks.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { wordKeyFor } from '@/lib/flickWords';
import DishName from '@/components/DishName';
import DishInfoDisplay from '@/components/DishInfoDisplay';
import { CheckIcon, CloseIcon } from '@/components/icons';

// A real nearby restaurant option (from EXIF → /api/restaurants/nearby), carrying what
// it takes to PERSIST the pick: a Dishi row (restaurant_id) or a Google place (place_id
// + coords → created on pick, same path as the log flow).
export type GrowPlace = {
  label: string;
  restaurant_id?: string;
  place_id?: string;
  lat: number;
  lng: number;
  source: 'dishi' | 'google';
};

// Each rated card's live pipeline state, streamed in by RatingStack as
// /api/dishes → seal → rate → enrich → nearby resolve.
export type GrowDish = {
  photoUrl: string | null;
  score: number;
  status: 'creating' | 'ready' | 'failed';
  dishId: string | null;
  isDish: boolean;
  name: string;
  name_zh: string | null;
  cuisine: string | null;
  ingredients: string[];
  diet: string[];
  heaviness: string | null;
  enriched: boolean;
  // location: real EXIF → nearby list; choice is owned by RatingStack (it persists it)
  // and read back here for display.
  coords?: { lat: number; lng: number } | null;
  nearby?: GrowPlace[];
  placeLoading?: boolean;
  hasLocation?: boolean;
  choice?: string | null;
};

type Dish = {
  named: boolean;
  ing: string[]; diet: string[]; heaviness?: string;
  places: string[]; placeLoading: boolean; hasLocation: boolean;
  choice?: string; done: boolean;
  notDish?: boolean;     // vision said this photo isn't food — never learned from
  reenriching?: boolean; // a name change is re-deriving the ingredients (chips animate out→in)
  reVer?: number;        // bumps on each re-derive so the chip block remounts + re-animates
};

const BASE = 38;
const CAP = 96;
const emptyDish = (): Dish => ({ named: false, ing: [], diet: [], places: [], placeLoading: false, hasLocation: false, done: false });

type Flyer = { id: number; word: string; x: number; y: number };

export type NameEdit = { zh: string; en: string; edZh: boolean; edEn: boolean };
export type GrowEngine = { fill: number; ready: boolean; hintKey: string; hintParams?: Record<string, number> };

export default function TasteGrowth({ live, engine, onExit, onCancel, onPickPlace, onEditName, onReclassify }: {
  live: GrowDish[];
  engine?: GrowEngine | null;                            // REAL taste-engine confidence for the bar
  onExit: () => void;                                    // the ✓ = done / keep
  onCancel?: () => void;                                 // the ✕ = discard the session
  onPickPlace?: (i: number, label: string) => void;      // persist a restaurant pick
  onEditName?: (i: number, edit: NameEdit) => void;      // persist a rename (full cascade)
  onReclassify?: (i: number, edit: NameEdit) => void;    // "it IS food" → name + rate it
}) {
  const { t } = useLang();
  const rowCount = live.length;
  // Per-row NAME/ingredient source (the real dish; optimistic edits flow back via `live`).
  const srcOf = (i: number) => ({ zh: live[i]?.name_zh ?? '', en: live[i]?.name ?? '', ing: live[i]?.ingredients ?? [] });
  const [dishes, setDishes] = useState<Dish[]>(() => Array.from({ length: rowCount }, emptyDish));
  const [fill, setFill] = useState(BASE);
  const [absorbed, setAbsorbed] = useState(0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  // A dish's place is auto-confirmed to the top EXIF guess; the user only opens the full
  // nearby list (kept collapsed to cut load) when they tap the pill.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const home = t('place.home');
  const skip = t('grow.skip');
  // Name editing mirrors the Eat Journal exactly: two fields (zh primary / en secondary);
  // editing one CLEARS the other (which shows a "will translate" placeholder), retranslated on save.
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [dZh, setDZh] = useState(''); const [dEn, setDEn] = useState('');
  const [edZh, setEdZh] = useState(false); const [edEn, setEdEn] = useState(false);
  // True while the open editor was reached via "it IS food" on a non-dish row — so
  // cancelling (or saving with no name) reverts to the not-a-dish state.
  const [editReclassify, setEditReclassify] = useState(false);
  const flyId = useRef(0);

  // A quality (or a refinement) flies into the blob → blob absorbs + grows, bar bumps.
  const absorb = (word: string, bump: number) => {
    const ang = Math.random() * Math.PI * 2, rad = 96 + Math.random() * 54;
    const id = ++flyId.current;
    setFlyers(prev => [...prev, { id, word, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.7 }]);
    window.setTimeout(() => setFlyers(prev => prev.filter(f => f.id !== id)), 1100);
    setAbsorbed(a => a + 1);
    setFill(f => Math.min(100, f + bump));
  };

  // Sync the render model from the real pipeline stream, and fire the blob + bar on REAL
  // events only (a dish resolves, then enriches) — never on raw count.
  const liveSeen = useRef<Record<number, { ready?: boolean; enriched?: boolean }>>({});
  useEffect(() => {
    setDishes(prev => live.map((gd, i) => {
      const cur = prev[i] ?? emptyDish();
      return {
        ...cur,
        named: gd.status !== 'creating',
        done: gd.status !== 'creating',
        notDish: gd.status === 'ready' && !gd.isDish,
        ing: cur.reenriching ? cur.ing : (gd.ingredients ?? []), // don't clobber a mid-animation re-derive
        diet: gd.diet ?? [],
        heaviness: gd.heaviness ?? undefined,
        places: (gd.nearby ?? []).map(p => p.label),
        placeLoading: gd.placeLoading ?? false,
        hasLocation: gd.hasLocation ?? false,
        choice: gd.choice ?? undefined,
      };
    }));
    live.forEach((gd, i) => {
      const s = (liveSeen.current[i] ??= {});
      if (!s.ready && gd.status === 'ready' && gd.isDish) { s.ready = true; if (gd.name) absorb(gd.name, 0); }
      if (!s.enriched && gd.enriched && gd.isDish) {
        s.enriched = true;
        // Fly the REAL learned data into the blob — a staggered STREAM of tokens
        // (diet labels + ingredients) so the absorption reads.
        const diet = (gd.diet ?? []).map(f => t(`scan.diet.${f}` as Parameters<typeof t>[0])).filter(Boolean);
        const words = [...diet, ...(gd.ingredients ?? [])].slice(0, 6);
        (words.length ? words : ['✓']).forEach((w, k) => window.setTimeout(() => absorb(w, 0), k * 150));
      }
    });
    // Session progress drives the bar UNTIL the real engine reading arrives (see barFill).
    const real = live.filter(g => g.isDish);
    const denom = Math.max(1, real.length * 2);
    const prog = real.reduce((a, g) => a + (g.status !== 'creating' ? 1 : 0) + (g.enriched ? 1 : 0), 0);
    setFill(BASE + (CAP - BASE) * (prog / denom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // The bar reads REAL taste-engine confidence toward the AI-export unlock (from
  // /api/buddy), with the honest growth hint under it. Before the first reading lands it
  // falls back to session progress.
  const dishesLeft = Math.max(0, Math.ceil((100 - fill) / 10));
  const barFill = engine ? engine.fill : fill;
  const barLine = engine
    ? (engine.ready ? t('grow.ready') : t(engine.hintKey, engine.hintParams))
    : (dishesLeft <= 0 ? t('grow.ready') : t('grow.toready', { n: dishesLeft }));
  const blobScale = 0.72 + Math.min(absorbed, 16) * 0.05;

  // refinement = reward: RatingStack owns the choice (it persists it) — it round-trips
  // back via `live`.
  const choose = (i: number, place: string) => {
    onPickPlace?.(i, place);
    setExpanded(prev => { const n = new Set(prev); n.delete(i); return n; }); // collapse back to the single confirmed chip
    absorb('✓', 2.5);
  };
  const expand = (i: number) => setExpanded(prev => new Set(prev).add(i));
  // Fixing a name changes what the dish IS — the derived ingredients re-derive: the chips
  // fall away, a brief "re-analysing", then they land again (RatingStack does the real
  // reanalyzeAnchored; this is the animation).
  const reReenrich = (i: number) => {
    const p = srcOf(i);
    if (p.ing.length === 0) return; // nothing to re-derive (e.g. a just-named non-dish)
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ing: [], reenriching: true } : d)));
    window.setTimeout(() => {
      setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ing: p.ing, reenriching: false, reVer: (d.reVer ?? 0) + 1 } : d)));
      absorb('✓', 1.5);
    }, 720);
  };
  // "It IS food" — flip a mis-flagged non-dish back to a dish and open the name editor.
  const markAsDish = (i: number) => {
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, notDish: false, named: true } : d)));
    setEditIdx(i); setDZh(''); setDEn(''); setEdZh(false); setEdEn(false); setEditReclassify(true);
  };
  const revertToNotDish = (i: number) =>
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, notDish: true, named: false } : d)));
  const startEdit = (i: number) => {
    const p = srcOf(i);
    setEditIdx(i); setDZh(p.zh); setDEn(p.en); setEdZh(false); setEdEn(false);
  };
  const cancelEdit = () => {
    if (editReclassify && editIdx !== null) revertToNotDish(editIdx);
    setEditReclassify(false); setEditIdx(null);
  };
  const commitEdit = () => {
    if (editIdx === null) return;
    const i = editIdx;
    if (edZh || edEn) {
      const zh = dZh.trim(), en = dEn.trim();
      // RatingStack persists (rename cascade / reclassify+rate); the canonical name +
      // re-derived data flow back via the stream.
      if (editReclassify) onReclassify?.(i, { zh, en, edZh, edEn });
      else onEditName?.(i, { zh, en, edZh, edEn });
      absorb(zh || en || '✓', 2.5);
      setEditReclassify(false); setEditIdx(null);
      reReenrich(i); // re-derive the ingredient chips with animation
      return;
    }
    // Saved without typing a name: on a reclassify that means "still not a dish".
    if (editReclassify) revertToNotDish(i);
    setEditReclassify(false); setEditIdx(null);
  };

  return (
    <div className="grow2">
      <div className="grow2-top">
        {/* inside the sticky header so it stays pinned at the top as the stream scrolls */}
        <button className="grow-close" onClick={onCancel ?? onExit} aria-label={t('grow.close')}><CloseIcon size={18} /></button>
        <div className="grow-blobwrap">
          {flyers.map(f => (
            <span key={f.id} className="blob-flyer"
              style={{ ['--x' as string]: `${f.x}px`, ['--y' as string]: `${f.y}px` } as React.CSSProperties}>{f.word}</span>
          ))}
          <div className="grow-blob" style={{ transform: `scale(${blobScale.toFixed(3)})` }} aria-hidden>
            <svg viewBox="0 0 100 100" width="66" height="66">
              <path d="M50 6 C71 6 92 20 93 44 C94 68 79 92 53 94 C29 96 9 81 7 55 C5 30 27 6 50 6 Z" fill="var(--ink)" />
            </svg>
          </div>
        </div>
        <h2 className="grow2-title">{t('grow.build.title')}</h2>

        <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(barFill)}><div className="xp-fill" style={{ width: `${barFill}%` }} /></div>
        <p className="grow2-toready">{barLine}</p>
      </div>

      {/* One ask above the rows: confirming/refining is what makes the engine accurate,
          and it's optional (now or later). */}
      <p className="grow-refine-ask">{t('grow.confirm.ask')}</p>

      <ul className="learn-list">
        {live.map((it, i) => {
          const d = dishes[i] ?? emptyDish();
          const p = srcOf(i);
          const thumb = (
            <div className={`learn-thumb${d.notDish ? ' learn-thumb-dim' : ''}`}>
              {it.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={it.photoUrl} alt="" />
                : <span>🍽️</span>}
            </div>
          );

          // Not food: a quiet, dimmed row that taught the engine nothing — with a single
          // "it IS food" correction that flips it back to a nameable dish.
          if (d.notDish) {
            return (
              <li key={i} className="learn-row not-dish is-done">
                {thumb}
                <div className="learn-main not-dish-main">
                  <span className="learn-name">{t('grow.notfood')}</span>
                  <button className="chip chip-util not-dish-fix" onClick={() => markAsDish(i)}>{t('grow.notfood.fix')}</button>
                </div>
              </li>
            );
          }

          const showPlace = d.placeLoading || d.places.length > 0 || (d.done && !d.hasLocation);
          const isHome = d.choice === home;
          const isSkip = d.choice === skip;
          const showList = expanded.has(i) || (showPlace && !d.choice && !d.placeLoading);
          return (
            <li key={i} className={`learn-row ${d.done ? 'is-done' : 'is-working'}`}>
              {/* Photo + verdict beneath it — the rating belongs under the shot, like the
                  Eat Journal (journal-photo-col), not inline with the name. */}
              <div className="learn-thumbcol">
                {thumb}
                {d.done && <div className="learn-verdict">{t(wordKeyFor(it.score))}</div>}
              </div>
              <div className="learn-main">
                <div className="learn-head">
                  {!d.named
                    ? <span className="learn-name learn-skel">{t('grow.analysing')}</span>
                    : editIdx === i
                      ? <div className="learn-nameedit">
                          <div className="name-edit-labelrow">
                            <label className="label learn-editlabel">{t('home.name.zh')}</label>
                            <span className="card-meta name-edit-note">{t('home.translateOnSave')}</span>
                          </div>
                          <input className="field" value={dZh} autoFocus
                            placeholder={edEn && !edZh ? t('log.willTranslate') : undefined}
                            onChange={e => { setDZh(e.target.value); setEdZh(true); if (!edEn) setDEn(''); }} />
                          <label className="label learn-editlabel">{t('home.name.en')}</label>
                          <input className="field" value={dEn}
                            placeholder={edZh && !edEn ? t('log.willTranslate') : undefined}
                            onChange={e => { setDEn(e.target.value); setEdEn(true); if (!edZh) setDZh(''); }} />
                          <div className="learn-editactions">
                            <button className="btn ghost small" onClick={cancelEdit}>{t('home.cancel')}</button>
                            <button className="btn primary small" onClick={commitEdit}>{t('home.save')}</button>
                          </div>
                        </div>
                      // The name is a "refine" tile — a rounded rectangle (like the thumb),
                      // gently breathing so it reads as tap-to-change. One language is enough.
                      : <button className="refine-pill refine-name" onClick={() => startEdit(i)} aria-label={t('grow.rename')}>
                          <DishName name={p.en} name_zh={p.zh} size="md" />
                        </button>}
                </div>

                {/* A name change re-derives the ingredients: chips fall away → "re-analysing"
                    → they land again (keyed by reVer so only a re-derive re-animates). */}
                {d.reenriching
                  ? <div className="learn-reenrich">{t('grow.reanalysing')}</div>
                  : (d.ing.length > 0 || d.diet.length > 0) && (
                      <div className="learn-info-reveal" key={d.reVer ?? 0}>
                        <DishInfoDisplay info={{ ingredients: d.ing, diet: d.diet, heaviness: d.heaviness }} hideHook compact />
                      </div>
                    )}

                {showPlace && (
                  d.placeLoading && d.places.length === 0
                    ? <div className="learn-place"><span className="learn-finding">{t('grow.finding')}</span></div>
                    : !showList && d.choice
                      // Resolved: the location as a breathing "refine" pill — tap to open the list.
                      ? <div className="learn-place">
                          <button className="refine-pill refine-place" onClick={() => expand(i)}>
                            {!isSkip && <span aria-hidden>{isHome ? '🏠' : '📍'} </span>}{d.choice}
                          </button>
                        </div>
                      // Expanded: the nearest spots (the fixed 10) + add / skip / home — the
                      // SAME .chip-util treatment and order as the restaurant picker log flow.
                      : <div className="chips learn-place">
                          {d.places.map(pl => (
                            <button key={pl} className={`chip ${d.choice === pl ? 'on' : ''}`} onClick={() => choose(i, pl)}>{pl}</button>
                          ))}
                          <button className="chip chip-util" onClick={() => choose(i, t('grow.addplace'))}>{t('picker.add')}</button>
                          <button className={`chip chip-util ${isSkip ? 'on' : ''}`} onClick={() => choose(i, skip)}>{skip}</button>
                          <button className={`chip chip-util ${isHome ? 'on' : ''}`} onClick={() => choose(i, home)}>{home}</button>
                        </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Done = a single black check (everything is optimistic-committed already;
          you can still refine later). */}
      <div className="grow-okwrap">
        <button className="grow-ok" onClick={onExit} aria-label={t('grow.build.title')}><CheckIcon size={26} /></button>
      </div>
    </div>
  );
}
