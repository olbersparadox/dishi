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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { ingredientZh } from '@/lib/ingredientLabel';
import { wordKeyFor } from '@/lib/flickWords';
import DishName from '@/components/DishName';
import DishInfoDisplay from '@/components/DishInfoDisplay';
import { CheckIcon, CloseIcon } from '@/components/icons';
import { topGlyphDims, type FormInputs } from '@/lib/blobForm';
import { TasteFormLive } from '@/components/TasteForm';

// A real nearby restaurant option (from EXIF → /api/restaurants/nearby), carrying what
// it takes to PERSIST the pick: a Dishi row (restaurant_id) or a Google place (place_id
// + coords → created on pick, same path as the log flow).
export type GrowPlace = {
  label: string;
  restaurant_id?: string;
  place_id?: string;
  lat: number;
  lng: number;
  /** 'manual' = typed by the person via "+ 加間舖" (no place_id, coords may be 0). */
  source: 'dishi' | 'google' | 'manual';
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
  /** A typed "+ 加間舖" couldn't be saved (no position available, or the write failed) —
   *  shown rather than silently dropping what the person typed. */
  placeError?: boolean;
  // Bumped by RatingStack when a REAL post-rename re-derivation lands (or fails —
  // always bumped, so the re-analysing state can't stick). Drives the chip
  // out→in animation on DATA, replacing the old 720ms timer simulation.
  enrichGen?: number;
};

type Dish = {
  named: boolean;
  ing: string[]; diet: string[]; heaviness?: string;
  places: string[]; placeLoading: boolean; hasLocation: boolean;
  choice?: string; done: boolean;
  placeError?: boolean;  // a typed "+ 加間舖" couldn't be saved — offer it again, don't drop it
  notDish?: boolean;     // vision said this photo isn't food — never learned from
  failed?: boolean;      // the upload itself bounced (413/network) — NOTHING was saved
  reenriching?: boolean; // a rename committed; the REAL re-derivation hasn't landed yet
  reVer?: number;        // bumps when a re-derive LANDS so the chip block remounts + re-animates
};

const BASE = 38;
const CAP = 96;
const emptyDish = (): Dish => ({ named: false, ing: [], diet: [], places: [], placeLoading: false, hasLocation: false, done: false });

type Flyer = { id: number; word: string; x: number; y: number };

export type NameEdit = { zh: string; en: string; edZh: boolean; edEn: boolean };
export type GrowEngine = {
  fill: number; ready: boolean; v: number; hintKey: string; hintParams?: Record<string, number>;
  /** True only when the version ratcheted UP during THIS session — the one moment
   *  「已經解鎖」 is news. Otherwise the line reads as progress toward v{n+1}. */
  justUnlocked?: boolean;
};

export default function TasteGrowth({ live, engine, blobInputs, onExit, onCancel, onPickPlace, onAddPlace, onEditName, onReclassify, onRetry }: {
  live: GrowDish[];
  engine?: GrowEngine | null;                            // REAL taste-engine confidence for the bar
  // The REAL profile (same vector/evidence/ratingCount/seed blobForm.ts consumes
  // everywhere else) — the header blob is sampled from this, not a fixed mock
  // shape, so it's the actual identity the person is building, growing as ratings
  // commit during the session. null while the first /api/buddy read is in flight.
  blobInputs?: FormInputs | null;
  onExit: () => void;                                    // the ✓ = done / keep
  onCancel?: () => void;                                 // the ✕ = discard the session
  onPickPlace?: (i: number, label: string) => void;      // persist a restaurant pick
  onAddPlace?: (i: number, name: string) => void;        // persist a TYPED restaurant name
  onEditName?: (i: number, edit: NameEdit) => void;      // persist a rename (full cascade)
  onReclassify?: (i: number, edit: NameEdit) => void;    // "it IS food" → name + rate it
  onRetry?: (i: number) => void;                         // re-run the pipeline on a failed upload
}) {
  const { t, lang } = useLang();
  const rowCount = live.length;
  // Per-row NAME/ingredient source (the real dish; optimistic edits flow back via `live`).
  const srcOf = (i: number) => ({ zh: live[i]?.name_zh ?? '', en: live[i]?.name ?? '', ing: live[i]?.ingredients ?? [] });

  // The header blob's REAL shape (was a fixed dev-mock path). Before the first
  // /api/buddy read lands, fall back to blobForm's own "nobody's rated anything yet"
  // input — the same small, plain circle a brand-new profile draws everywhere else,
  // not a placeholder shape invented here. Recomputes whenever the live profile
  // changes (RatingStack refreshes it after every seal/rate/enrich), so the blob's
  // actual silhouette grows mid-session as ratings commit.
  const effectiveBlobInputs: FormInputs = blobInputs ?? { vector: {}, evidence: {}, ratingCount: 0, seed: 'grow:loading' };
  // The header blob IS the Taste-AI blob — the same TasteFormLive canvas (ink
  // gradient, breathing highlight, glyph characters), not a static SVG imitation of
  // it. Same inputs + same seed as the 味 AI card, so the two are pixel-siblings.
  const glyph = useMemo(
    () => topGlyphDims(effectiveBlobInputs.vector, effectiveBlobInputs.evidence).map(d => t(`dim.${d}`).charAt(0)).join(' '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(effectiveBlobInputs.vector), JSON.stringify(effectiveBlobInputs.evidence)],
  );
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
  const [addingIdx, setAddingIdx] = useState<number | null>(null); // "+ 加間舖" open on this row
  const [addName, setAddName] = useState('');
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
  const liveSeen = useRef<Record<number, { ready?: boolean; streamed?: boolean; gen?: number }>>({});
  useEffect(() => {
    setDishes(prev => live.map((gd, i) => {
      const cur = prev[i] ?? emptyDish();
      // A post-rename re-derivation LANDED (enrichGen moved): stop holding the blank
      // "re-analysing" state and let the fresh chips animate in (reVer remount).
      const landed = (gd.enrichGen ?? 0) > (liveSeen.current[i]?.gen ?? 0);
      return {
        ...cur,
        named: gd.status !== 'creating',
        done: gd.status !== 'creating',
        notDish: gd.status === 'ready' && !gd.isDish,
        failed: gd.status === 'failed',
        ing: cur.reenriching && !landed ? cur.ing : (gd.ingredients ?? []),
        reenriching: cur.reenriching && !landed,
        reVer: landed ? (cur.reVer ?? 0) + 1 : cur.reVer,
        diet: gd.diet ?? [],
        heaviness: gd.heaviness ?? undefined,
        places: (gd.nearby ?? []).map(p => p.label),
        placeLoading: gd.placeLoading ?? false,
        hasLocation: gd.hasLocation ?? false,
        choice: gd.choice ?? undefined,
        placeError: gd.placeError ?? false,
      };
    }));
    live.forEach((gd, i) => {
      const s = (liveSeen.current[i] ??= {});
      if (!s.ready && gd.status === 'ready' && gd.isDish) { s.ready = true; if (gd.name) absorb(gd.name, 0); }
      // Fly the REAL learned data into the blob — a staggered STREAM of tokens (diet
      // labels + ingredients). Fire ONCE, the moment they first arrive: for a photo
      // dish that's at create (vision reads them off); for a typed-name dish it's when
      // enrich lands. Keyed off token PRESENCE, not the enriched flag, so photo dishes
      // (fully known at create) still animate.
      if (!s.streamed && gd.isDish && gd.status === 'ready') {
        const diet = (gd.diet ?? []).map(f => t(`scan.diet.${f}` as Parameters<typeof t>[0])).filter(Boolean);
        // Ingredients stream in the chrome language too — the SAME glossary the
        // dish-info chips use (ingredientLabel.ts), so a word never disagrees with
        // itself between the flying absorb effect and the chip below it. zh label
        // when the glossary has one, English only when it doesn't — never a
        // fabricated translation.
        const ingredients = (gd.ingredients ?? []).map(i => (lang === 'zh' ? (ingredientZh(i) ?? i) : i));
        const words = [...diet, ...ingredients].slice(0, 6);
        if (words.length) { s.streamed = true; words.forEach((w, k) => window.setTimeout(() => absorb(w, 0), k * 150)); }
      }
      // The real re-derivation landed → the blob + bar respond to the ACTUAL new learning.
      if ((gd.enrichGen ?? 0) > (s.gen ?? 0)) { s.gen = gd.enrichGen; absorb('✓', 1.5); }
    });
    // Session progress drives the bar UNTIL the real engine reading arrives (see barFill).
    const real = live.filter(g => g.isDish);
    const denom = Math.max(1, real.length * 2);
    const prog = real.reduce((a, g) => a + (g.status !== 'creating' ? 1 : 0) + (g.enriched ? 1 : 0), 0);
    setFill(BASE + (CAP - BASE) * (prog / denom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // The bar reads the REAL dishi version ladder (from /api/buddy): progress toward
  // the next version, with 「dishi v{n} 已經解鎖」 once v1+ is reached, or the honest
  // growth hint while still locked. Before the first reading lands it falls back to
  // session progress (and a neutral analysing line — never a fake unlock claim).
  const barFill = engine ? engine.fill : fill;
  // Never NAME a version we haven't read. The old fallback hardcoded "解鎖 dishi v1",
  // which lied to anyone already past v1; until the real reading lands the line is a
  // neutral "analysing" instead.
  const barLine = engine
    ? (engine.ready
        // 「已經解鎖」 only when the unlock happened in THIS session; a long-unlocked
        // profile instead reads its live progress toward the next version.
        ? (engine.justUnlocked ? t('version.unlocked', { n: engine.v }) : t('grow.vnext', { v: engine.v, next: engine.v + 1 }))
        : t(engine.hintKey, engine.hintParams))
    : t('grow.analysing');
  // Gentler range than the old 66px SVG needed: the canvas is already near full
  // header height, so growth reads as swelling, not ballooning past the wrap.
  const blobScale = 0.85 + Math.min(absorbed, 16) * 0.012;

  // refinement = reward: RatingStack owns the choice (it persists it) — it round-trips
  // back via `live`.
  const choose = (i: number, place: string) => {
    onPickPlace?.(i, place);
    setExpanded(prev => { const n = new Set(prev); n.delete(i); return n; }); // collapse back to the single confirmed chip
    absorb('✓', 2.5);
  };
  // Typed restaurant name → persisted as a new restaurant for this dish, then collapse
  // to the confirmed pill exactly like picking a nearby one.
  const commitAddPlace = (i: number) => {
    const name = addName.trim();
    if (!name) return;
    onAddPlace?.(i, name);
    setAddingIdx(null); setAddName('');
    setExpanded(prev => { const n = new Set(prev); n.delete(i); return n; });
    absorb('✓', 2.5);
  };
  const expand = (i: number) => setExpanded(prev => new Set(prev).add(i));
  // Fixing a name changes what the dish IS — the chips fall away into a real
  // "re-analysing" state, and land again ONLY when the actual name-seeded
  // re-derivation arrives (GrowDish.enrichGen bump in the live-sync above). The old
  // version here was a 720ms timer that restored the OLD chips — a simulated
  // re-analysis, killed for honesty. No prior-chips guard either: a just-named dish
  // with no chips yet is exactly the case that NEEDS its first derivation.
  const reReenrich = (i: number) =>
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ing: [], reenriching: true } : d)));
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
            {/* key on seed: TasteFormLive samples its shape once per mount (deps
                [inputs.seed, size]), so remount when the real profile arrives —
                otherwise the loading-fallback circle would stick for the session. */}
            <TasteFormLive key={effectiveBlobInputs.seed} inputs={effectiveBlobInputs} size={150} glyph={glyph} />
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
            <div className={`learn-thumb${d.notDish || d.failed ? ' learn-thumb-dim' : ''}`}>
              {it.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={it.photoUrl} alt="" />
                : <span>🍽️</span>}
            </div>
          );

          // Upload failed (413/network/5xx — NOTHING was saved, nobody ever looked at
          // the photo): say so instead of masquerading as a healthy row, and offer a
          // retry — the file is still in memory, and the flick score is held for it.
          // No name/place UI here: an edit on a dishId-less card would silently go
          // nowhere, which is exactly the failure class this kills.
          if (d.failed) {
            return (
              <li key={i} className="learn-row not-dish is-done">
                {thumb}
                <div className="learn-main not-dish-main">
                  <span className="learn-name">{t('grow.fail')}</span>
                  <button className="chip chip-util not-dish-fix" onClick={() => onRetry?.(i)}>{t('log.visionfail.retry')}</button>
                </div>
              </li>
            );
          }

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
                            {/* Vermillion once the name's actually been edited. */}
                            <button className={`btn primary small ${edZh || edEn ? 'dirty' : ''}`} onClick={commitEdit}>{t('home.save')}</button>
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
                      : addingIdx === i
                        // "+ 加間舖" used to just stamp the literal label 「自己加」 and
                        // persist nothing. Now it opens a real field: type the shop's
                        // name and it's saved as a new restaurant for this dish.
                        ? <div className="learn-place learn-addplace">
                            <input className="field" value={addName} autoFocus
                              placeholder={t('picker.addname')}
                              onChange={e => setAddName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitAddPlace(i); }} />
                            <div className="learn-editactions">
                              <button className="btn ghost small" onClick={() => { setAddingIdx(null); setAddName(''); }}>{t('home.cancel')}</button>
                              <button className={`btn primary small ${addName.trim() ? 'dirty' : ''}`}
                                disabled={!addName.trim()} onClick={() => commitAddPlace(i)}>{t('home.save')}</button>
                            </div>
                          </div>
                        : d.placeError
                        ? <div className="learn-place">
                            <span className="learn-finding">{t('grow.addplace.failed')}</span>
                            <button className="chip chip-util" onClick={() => { setAddingIdx(i); setAddName(''); }}>{t('picker.add')}</button>
                          </div>
                        : <div className="chips learn-place">
                            {d.places.map(pl => (
                              <button key={pl} className={`chip ${d.choice === pl ? 'on' : ''}`} onClick={() => choose(i, pl)}>{pl}</button>
                            ))}
                            <button className="chip chip-util" onClick={() => { setAddingIdx(i); setAddName(''); }}>{t('picker.add')}</button>
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
        <button className="ok-circle" onClick={onExit} aria-label={t('grow.build.title')}><CheckIcon size={26} /></button>
      </div>
    </div>
  );
}
