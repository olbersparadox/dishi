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

export type GrowItem = { photoUrl: string | null; score: number };

type Dish = {
  named: boolean;
  ing: string[]; diet: string[]; heaviness?: string;
  places: string[]; placeLoading: boolean; hasLocation: boolean;
  choice?: string; done: boolean;
  notDish?: boolean; // vision said this photo isn't food — never learned from
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

export default function TasteGrowth({ items, onExit }: { items: GrowItem[]; onExit: () => void }) {
  const { t } = useLang();
  const [dishes, setDishes] = useState<Dish[]>(() => items.map(emptyDish));
  const [names, setNames] = useState<({ zh: string; en: string } | undefined)[]>(() => items.map(() => undefined)); // name overrides
  const [fill, setFill] = useState(BASE);
  const [absorbed, setAbsorbed] = useState(0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  // A dish's place is auto-confirmed to the top EXIF guess; the user only opens the
  // full nearby list (kept collapsed to cut load) when they tap "唔啱?".
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const home = t('place.home');
  // Name editing mirrors the Eat Journal exactly: two fields (zh primary / en
  // secondary); editing one CLEARS the other (which shows a "will translate"
  // placeholder and is re-translated on save).
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [dZh, setDZh] = useState(''); const [dEn, setDEn] = useState('');
  const [edZh, setEdZh] = useState(false); const [edEn, setEdEn] = useState(false);
  const flyId = useRef(0);

  // A quality (or a refinement) flies into the blob → blob absorbs + grows, bar bumps.
  const absorb = (word: string, bump: number) => {
    const ang = Math.random() * Math.PI * 2, rad = 72 + Math.random() * 40;
    const id = ++flyId.current;
    setFlyers(prev => [...prev, { id, word, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.68 }]);
    window.setTimeout(() => setFlyers(prev => prev.filter(f => f.id !== id)), 900);
    setAbsorbed(a => a + 1);
    setFill(f => Math.min(100, f + bump));
  };

  useEffect(() => {
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

  const doneCount = dishes.filter(d => d.done).length;
  const allDone = doneCount === items.length;
  const remain = Math.max(0, Math.round(100 - fill));
  const blobScale = 0.72 + Math.min(absorbed, 16) * 0.04;

  // refinement = reward: picking a place or fixing a name teaches more.
  const choose = (i: number, place: string) => {
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, choice: place } : d)));
    setExpanded(prev => { const n = new Set(prev); n.delete(i); return n; }); // collapse back to the single confirmed chip
    absorb('✓', 2.5);
  };
  const expand = (i: number) => setExpanded(prev => new Set(prev).add(i));
  // "It IS food" — flip a mis-flagged non-dish back to a dish and open the name editor
  // so the person can tell us what it is (then it can start teaching the engine).
  const markAsDish = (i: number) => {
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, notDish: false, named: true } : d)));
    setEditIdx(i); setDZh(''); setDEn(''); setEdZh(false); setEdEn(false);
  };
  const startEdit = (i: number) => {
    const p = POOL[i % POOL.length], cur = names[i];
    setEditIdx(i); setDZh(cur?.zh ?? p.zh); setDEn(cur?.en ?? p.en); setEdZh(false); setEdEn(false);
  };
  const cancelEdit = () => setEditIdx(null);
  const commitEdit = () => {
    if (editIdx === null) return;
    const i = editIdx, p = POOL[i % POOL.length];
    if (edZh || edEn) {
      const zh = dZh.trim(), en = dEn.trim();
      // Real app re-translates the cleared field on save; the demo falls back to the
      // pool value as a stand-in so both slots always display.
      setNames(prev => prev.map((n, j) => (j === i ? { zh: zh || p.zh, en: en || p.en } : n)));
      absorb(zh || en || '✓', 2.5);
    }
    setEditIdx(null);
  };

  return (
    <div className="grow2">
      <div className="grow2-top">
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
        <h2 className="grow2-title">{allDone ? t('grow.done.title') : t('grow.work.title')}</h2>

        <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(fill)}><div className="xp-fill" style={{ width: `${fill}%` }} /></div>
        <p className="grow2-unlock">{fill >= 100 ? t('rate.grow.unlocked') : t('rate.grow.remain', { p: remain })}</p>
      </div>

      {/* One ask above the rows: confirming/refining is what makes the engine accurate,
          and it's optional (now or later). */}
      <p className="grow-refine-ask">{t('grow.confirm.ask')}</p>

      <ul className="learn-list">
        {items.map((it, i) => {
          const d = dishes[i];
          const p = POOL[i % POOL.length];
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
                <div className="learn-main">
                  <span className="not-dish-title">{t('grow.notfood')}</span>
                  <span className="not-dish-sub">{t('grow.notfood.sub')}</span>
                  <button className="not-dish-fix" onClick={() => markAsDish(i)}>{t('grow.notfood.fix')}</button>
                </div>
              </li>
            );
          }

          const showPlace = d.placeLoading || d.places.length > 0 || (d.done && !d.hasLocation);
          const isHome = d.choice === home;
          const showList = expanded.has(i) || (showPlace && !d.choice && !d.placeLoading);
          // low-confidence guess with no pick yet → pull the row forward for a look.
          const needsLook = !!p.uncertain && d.done && !d.choice;
          return (
            <li key={i} className={`learn-row ${d.done ? 'is-done' : 'is-working'}${needsLook ? ' needs-look' : ''}`}>
              {thumb}
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
                      // The name is a glowing "refine" pill — tap to change it (one language
                      // is enough; the other re-translates on save).
                      : <button className="refine-pill refine-name" onClick={() => startEdit(i)} aria-label={t('grow.rename')}>
                          <DishName name={names[i]?.en ?? p.en} name_zh={names[i]?.zh ?? p.zh} size="md" />
                        </button>}
                  {editIdx !== i && <span className="learn-word">{t(wordKeyFor(it.score))}</span>}
                </div>

                {(d.ing.length > 0 || d.diet.length > 0) && (
                  <DishInfoDisplay info={{ ingredients: d.ing, diet: d.diet, heaviness: d.heaviness }} hideHook compact />
                )}

                {showPlace && (
                  d.placeLoading && d.places.length === 0
                    ? <div className="learn-place"><span className="learn-finding">{t('grow.finding')}</span></div>
                    : !showList && d.choice
                      // Resolved: the location as a glowing "refine" pill — tap to open the list.
                      ? <div className="learn-place">
                          <button className="refine-pill refine-place" onClick={() => expand(i)}>
                            <span aria-hidden>{isHome ? '🏠' : '📍'}</span> {d.choice}
                          </button>
                        </div>
                      // Expanded: the nearest spots (the fixed 10) + the two coloured actions.
                      : <div className="chips learn-place">
                          {d.places.map(pl => (
                            <button key={pl} className={`chip ${d.choice === pl ? 'on' : ''}`} onClick={() => choose(i, pl)}>{pl}</button>
                          ))}
                          <button className={`chip chip-action ${isHome ? 'on' : ''}`} onClick={() => choose(i, home)}>🏠 {home}</button>
                          <button className="chip chip-action" onClick={() => choose(i, t('grow.addplace'))}>＋ {t('grow.addplace')}</button>
                        </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <button className="btn ghost grow2-leave" onClick={onExit}>
        {allDone ? t('grow.leave.done') : t('grow.leave.bg')}
      </button>
    </div>
  );
}
