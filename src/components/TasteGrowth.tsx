'use client';
// The reward + light review, MERGED (rating-flow revamp). You land here and WATCH
// your Taste AI learn — data STREAMS in like a response: each dish expands (bilingual
// name → ingredient/diet icon chips → all the nearby restaurants). Learned qualities
// FLY INTO the ink blob and grow it. And REFINING is rewarded: pick the right
// restaurant or fix a name and the bar + blob respond — every correction teaches more.
// The bar never moves on the raw rating count, only on real learning, so it's honest.
//
// Uses the app's real DishName + DishInfoDisplay + .xp-bar / .chip / .stat vocabulary
// so it matches production. DEMO NOTE: enrichment is SIMULATED — no real EXIF / vision.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { wordKeyFor } from '@/lib/flickWords';
import DishName from '@/components/DishName';
import DishInfoDisplay from '@/components/DishInfoDisplay';
import { CheckIcon, CloseIcon } from '@/components/icons';

// snapdemo harness (no auth): photo + score only; the dishes are SIMULATED from POOL.
export type GrowItem = { photoUrl: string | null; score: number };

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

// The real flow (RatingStack): each rated card's live pipeline state, streamed in as
// /api/dishes → seal → rate → enrich resolve. When `live` is passed the screen renders
// REAL dishes (no POOL); when only `items` is passed it runs the POOL simulation.
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
  // location (phase 3): real EXIF → nearby list; choice is owned here (RatingStack
  // persists it) and read back for display.
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

const POOL: {
  zh: string; en: string; ing: string[]; diet: string[]; heaviness: string;
  learned: string[]; places: string[] | null; uncertain?: boolean; notDish?: boolean;
}[] = [
  { zh: '叉燒飯', en: 'Char siu rice', ing: ['egg', 'scallion', 'garlic'], diet: ['pork'], heaviness: 'medium', learned: ['鮮味', '油香', '鹹'],
    places: ['大家樂（銅鑼灣）', '翠華餐廳', '太興', '東海堂', '再興燒臘', '一樂燒鵝', '華姐清湯腩', '甘牌燒鵝', '鏞記酒家', '敏華冰廳'] },
  { zh: '豚骨拉麵', en: 'Tonkotsu ramen', ing: ['egg', 'mushroom', 'scallion'], diet: ['pork'], heaviness: 'heavy', learned: ['濃郁', '鹹鮮', '油'],
    places: ['一蘭', '豚王', '麵屋一燈', '山頭火', '一風堂', '花丸烏冬', '拉麵Jo', '鵬天', '梅光軒'] },
  // A photo vision couldn't read as food (a receipt, a menu, a face…): it enriches to
  // NOTHING and teaches the engine NOTHING — shown as a quiet, correctable "not food" row.
  { zh: '', en: '', ing: [], diet: [], heaviness: '', learned: [], places: null, notDish: true },
  { zh: '紐約芝士蛋糕', en: 'NY cheesecake', ing: ['lemon', 'egg'], diet: ['dairy', 'egg'], heaviness: 'heavy', learned: ['香甜', '奶香', '微酸'], places: null },
  { zh: '水晶蝦餃', en: 'Har gow', ing: ['ginger'], diet: ['shellfish', 'seafood'], heaviness: 'light', learned: ['鮮甜', '煙韌'], uncertain: true,
    places: ['添好運', '點心到（中環）', '倫敦大酒樓', '稻香', '一點心', '明閣', '龍景軒', '陸羽茶室', '鴻星海鮮', '嘉麟樓'] },
  { zh: '牛油果沙律', en: 'Avocado salad', ing: ['avocado', 'tomato', 'lettuce', 'lemon'], diet: ['veg'], heaviness: 'light', learned: ['清新', 'creamy'], places: null },
];

const BASE = 38;
const CAP = 96;
const emptyDish = (): Dish => ({ named: false, ing: [], diet: [], places: [], placeLoading: false, hasLocation: false, done: false });

type Flyer = { id: number; word: string; x: number; y: number };

export type NameEdit = { zh: string; en: string; edZh: boolean; edEn: boolean };
export type GrowEngine = { fill: number; ready: boolean; hintKey: string; hintParams?: Record<string, number> };
export default function TasteGrowth({ items, live, engine, onExit, onCancel, onPickPlace, onEditName, onReclassify }: {
  items?: GrowItem[]; live?: GrowDish[]; onExit: () => void;
  engine?: GrowEngine | null;                            // live: REAL taste-engine confidence for the bar
  onCancel?: () => void;                                 // the ✕ = discard the session (live)
  onPickPlace?: (i: number, label: string) => void;    // live: RatingStack persists the pick
  onEditName?: (i: number, edit: NameEdit) => void;     // live: persist a rename (full cascade)
  onReclassify?: (i: number, edit: NameEdit) => void;   // live: "it IS food" → name + rate it
}) {
  const { t } = useLang();
  const isLive = !!live;
  // Unified per-row source: photo + score come from whichever mode; length drives all state.
  const rows: { photoUrl: string | null; score: number }[] = live ?? items ?? [];
  const rowCount = rows.length;
  // Per-row NAME/ingredient source: real dish in live mode, POOL entry in the sim.
  const srcOf = (i: number): { zh: string; en: string; ing: string[]; uncertain?: boolean } =>
    live
      ? { zh: live[i]?.name_zh ?? '', en: live[i]?.name ?? '', ing: live[i]?.ingredients ?? [], uncertain: false }
      : POOL[i % POOL.length];
  const [dishes, setDishes] = useState<Dish[]>(() => Array.from({ length: rowCount }, emptyDish));
  const [names, setNames] = useState<({ zh: string; en: string } | undefined)[]>(() => Array.from({ length: rowCount }, () => undefined)); // name overrides
  const [fill, setFill] = useState(BASE);
  const [absorbed, setAbsorbed] = useState(0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  // A dish's place is auto-confirmed to the top EXIF guess; the user only opens the
  // full nearby list (kept collapsed to cut load) when they tap "唔啱?".
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const home = t('place.home');
  const skip = t('grow.skip');
  // Name editing mirrors the Eat Journal exactly: two fields (zh primary / en
  // secondary); editing one CLEARS the other (which shows a "will translate"
  // placeholder and is re-translated on save).
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [dZh, setDZh] = useState(''); const [dEn, setDEn] = useState('');
  const [edZh, setEdZh] = useState(false); const [edEn, setEdEn] = useState(false);
  // True while the open editor was reached via "it IS food" on a non-dish row — so
  // cancelling (or saving with no name) reverts to the not-a-dish state instead of
  // leaving a nameless, dataless dish behind.
  const [editReclassify, setEditReclassify] = useState(false);
  const flyId = useRef(0);

  // A quality (or a refinement) flies into the blob → blob absorbs + grows, bar bumps.
  const absorb = (word: string, bump: number) => {
    const ang = Math.random() * Math.PI * 2, rad = 96 + Math.random() * 54; // bigger travel → more obvious
    const id = ++flyId.current;
    setFlyers(prev => [...prev, { id, word, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.7 }]);
    window.setTimeout(() => setFlyers(prev => prev.filter(f => f.id !== id)), 1100);
    setAbsorbed(a => a + 1);
    setFill(f => Math.min(100, f + bump));
  };

  // SIM path (snapdemo): stagger POOL data in on timers. Skipped entirely in live mode.
  useEffect(() => {
    if (isLive || !items) return;
    type Step = { i: number; apply?: (d: Dish) => Dish; learn?: string };
    type Ev = Step & { at: number };
    const evs: Ev[] = [];
    items.forEach((_, i) => {
      const p = POOL[i % POOL.length];
      const seq: Step[] = [];
      // Not food: vision looks, decides it isn't a dish, and stops. No name, no
      // ingredients, no place, nothing absorbed into the blob — a non-dish must never
      // move the taste engine. The row just resolves to a quiet, correctable state.
      if (p.notDish) {
        seq.push({ i, apply: d => ({ ...d, done: true, notDish: true }) });
        seq.forEach((ev, k) => evs.push({ ...ev, at: 450 + i * 400 + k * 400 + Math.random() * 150 }));
        return;
      }
      seq.push({ i, apply: d => ({ ...d, named: true }) });
      p.ing.forEach(g => seq.push({ i, apply: d => ({ ...d, ing: [...d.ing, g] }) }));
      seq.push({ i, apply: d => ({ ...d, diet: p.diet, heaviness: p.heaviness }) });
      if (p.places) {
        seq.push({ i, apply: d => ({ ...d, hasLocation: true, placeLoading: true }) });
        // Confident guess = auto-confirm the nearest (top) place; low-confidence
        // guess is left unset so the row asks the user to pick (pull-forward).
        seq.push({ i, apply: d => ({ ...d, places: p.places as string[], placeLoading: false, choice: d.choice ?? (p.uncertain ? undefined : (p.places as string[])[0]) }) });
      } else {
        seq.push({ i, apply: d => ({ ...d, hasLocation: false, choice: d.choice ?? home }) });
      }
      p.learned.forEach(l => seq.push({ i, learn: l }));
      seq.push({ i, apply: d => ({ ...d, done: true }) });
      seq.forEach((ev, k) => evs.push({ ...ev, at: 450 + i * 400 + k * 400 + Math.random() * 150 }));
    });
    const per = (CAP - BASE) / evs.length;
    let n = 0;
    const timers: number[] = [];
    evs.forEach(ev => {
      timers.push(window.setTimeout(() => {
        if (ev.apply) setDishes(prev => prev.map((d, j) => (j === ev.i ? ev.apply!(d) : d)));
        if (ev.learn) { absorb(ev.learn, 0); n += 1; setFill(Math.min(CAP, BASE + n * per)); return; }
        n += 1; setFill(Math.min(CAP, BASE + n * per));
      }, ev.at));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LIVE path: sync the render model from the real pipeline stream, and fire the blob +
  // bar on REAL events only (a dish resolves, then enriches) — never on raw count. The
  // bar reads real progress: half-credit when a dish is created, half when it enriches.
  const liveSeen = useRef<Record<number, { ready?: boolean; enriched?: boolean }>>({});
  useEffect(() => {
    if (!live) return;
    setDishes(prev => live.map((gd, i) => {
      const cur = prev[i] ?? emptyDish();
      return {
        ...cur,
        named: gd.status !== 'creating',
        done: gd.status !== 'creating',
        notDish: gd.status === 'ready' && !gd.isDish,
        // don't clobber a re-derive that's mid-animation
        ing: cur.reenriching ? cur.ing : (gd.ingredients ?? []),
        diet: gd.diet ?? [],
        heaviness: gd.heaviness ?? undefined,
        // location (phase 3): real EXIF nearby list + the confirmed choice, both owned
        // by RatingStack (single source of truth for what gets persisted).
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
        // Fly the REAL learned data into the blob — a staggered STREAM of tokens (diet
        // labels + ingredients), like the sim's taste words, so the absorption reads.
        const diet = (gd.diet ?? []).map(f => t(`scan.diet.${f}` as Parameters<typeof t>[0])).filter(Boolean);
        const words = [...diet, ...(gd.ingredients ?? [])].slice(0, 6);
        (words.length ? words : ['✓']).forEach((w, k) => window.setTimeout(() => absorb(w, 0), k * 150));
      }
    });
    const real = live.filter(g => g.isDish);
    const denom = Math.max(1, real.length * 2);
    const prog = real.reduce((a, g) => a + (g.status !== 'creating' ? 1 : 0) + (g.enriched ? 1 : 0), 0);
    setFill(BASE + (CAP - BASE) * (prog / denom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // The bar: in LIVE mode it reads REAL taste-engine confidence toward the AI-export
  // unlock (from /api/buddy), with the honest growth hint under it. The SIM falls back
  // to the session-progress mapping ("仲差 N 碟").
  const dishesLeft = Math.max(0, Math.ceil((100 - fill) / 10));
  const barFill = engine ? engine.fill : fill;
  const barLine = engine
    ? (engine.ready ? t('grow.ready') : t(engine.hintKey, engine.hintParams))
    : (dishesLeft <= 0 ? t('grow.ready') : t('grow.toready', { n: dishesLeft }));
  const blobScale = 0.72 + Math.min(absorbed, 16) * 0.05; // grows a bigger notch per absorbed token

  // refinement = reward: picking a place or fixing a name teaches more.
  const choose = (i: number, place: string) => {
    // Live: RatingStack owns the choice (it persists it) — round-trips back via `live`.
    // Sim: set the local choice directly.
    if (isLive) onPickPlace?.(i, place);
    else setDishes(prev => prev.map((d, j) => (j === i ? { ...d, choice: place } : d)));
    setExpanded(prev => { const n = new Set(prev); n.delete(i); return n; }); // collapse back to the single confirmed chip
    absorb('✓', 2.5);
  };
  const expand = (i: number) => setExpanded(prev => new Set(prev).add(i));
  // Fixing a name changes what the dish IS — so the derived ingredients re-derive:
  // the chips fall away, a brief "re-analysing", then they land again (and the blob +
  // bar catch the new learning). A real re-enrich (reanalyzeAnchored) replaces the
  // simulated one when this is wired to the backend.
  const reReenrich = (i: number) => {
    const p = srcOf(i);
    if (p.ing.length === 0) return; // nothing to re-derive (e.g. a just-named non-dish)
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ing: [], reenriching: true } : d)));
    window.setTimeout(() => {
      setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ing: p.ing, reenriching: false, reVer: (d.reVer ?? 0) + 1 } : d)));
      absorb('✓', 1.5); // the re-derived ingredients land → blob + bar respond again
    }, 720);
  };
  // "It IS food" — flip a mis-flagged non-dish back to a dish and open the name editor
  // so the person can tell us what it is (then it can start teaching the engine).
  const markAsDish = (i: number) => {
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, notDish: false, named: true } : d)));
    setEditIdx(i); setDZh(''); setDEn(''); setEdZh(false); setEdEn(false); setEditReclassify(true);
  };
  // Undo a reclassify that produced no name (cancel, or save-with-nothing): back to not-a-dish.
  const revertToNotDish = (i: number) =>
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, notDish: true, named: false } : d)));
  const startEdit = (i: number) => {
    const p = srcOf(i), cur = names[i];
    setEditIdx(i); setDZh(cur?.zh ?? p.zh); setDEn(cur?.en ?? p.en); setEdZh(false); setEdEn(false);
  };
  const cancelEdit = () => {
    if (editReclassify && editIdx !== null) revertToNotDish(editIdx);
    setEditReclassify(false); setEditIdx(null);
  };
  const commitEdit = () => {
    if (editIdx === null) return;
    const i = editIdx, p = srcOf(i);
    if (edZh || edEn) {
      const zh = dZh.trim(), en = dEn.trim();
      if (isLive) {
        // Live: RatingStack persists (rename cascade / reclassify+rate); the canonical
        // name + re-derived data flow back via the stream.
        if (editReclassify) onReclassify?.(i, { zh, en, edZh, edEn });
        else onEditName?.(i, { zh, en, edZh, edEn });
      } else {
        // Sim: the demo falls back to the pool value for a cleared field so both slots
        // always display.
        setNames(prev => prev.map((nm, j) => (j === i ? { zh: zh || p.zh, en: en || p.en } : nm)));
      }
      absorb(zh || en || '✓', 2.5);
      setEditReclassify(false); setEditIdx(null);
      reReenrich(i); // the name changed → re-derive the ingredient chips with animation
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
        {rows.map((it, i) => {
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
          // low-confidence guess with no pick yet → pull the row forward for a look.
          const needsLook = !!p.uncertain && d.done && !d.choice;
          return (
            <li key={i} className={`learn-row ${d.done ? 'is-done' : 'is-working'}${needsLook ? ' needs-look' : ''}`}>
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
                          <DishName name={names[i]?.en ?? p.en} name_zh={names[i]?.zh ?? p.zh} size="md" />
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
