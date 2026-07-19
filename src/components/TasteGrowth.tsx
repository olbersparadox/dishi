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
};

const POOL: {
  zh: string; en: string; ing: string[]; diet: string[]; heaviness: string;
  learned: string[]; places: string[] | null;
}[] = [
  { zh: '叉燒飯', en: 'Char siu rice', ing: ['egg', 'scallion', 'garlic'], diet: ['pork'], heaviness: 'medium', learned: ['鮮味', '油香', '鹹'],
    places: ['大家樂（銅鑼灣）', '翠華餐廳', '太興', '東海堂', '再興燒臘', '一樂燒鵝', '華姐清湯腩', '甘牌燒鵝', '鏞記酒家', '敏華冰廳'] },
  { zh: '豚骨拉麵', en: 'Tonkotsu ramen', ing: ['egg', 'mushroom', 'scallion'], diet: ['pork'], heaviness: 'heavy', learned: ['濃郁', '鹹鮮', '油'],
    places: ['一蘭', '豚王', '麵屋一燈', '山頭火', '一風堂', '花丸烏冬', '拉麵Jo', '鵬天', '梅光軒'] },
  { zh: '紐約芝士蛋糕', en: 'NY cheesecake', ing: ['lemon', 'egg'], diet: ['dairy', 'egg'], heaviness: 'heavy', learned: ['香甜', '奶香', '微酸'], places: null },
  { zh: '水晶蝦餃', en: 'Har gow', ing: ['ginger'], diet: ['shellfish', 'seafood'], heaviness: 'light', learned: ['鮮甜', '煙韌'],
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
  const [names, setNames] = useState<(string | undefined)[]>(() => items.map(() => undefined)); // name overrides (edits)
  const [fill, setFill] = useState(BASE);
  const [absorbed, setAbsorbed] = useState(0);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
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
      seq.push({ i, apply: d => ({ ...d, named: true }) });
      p.ing.forEach(g => seq.push({ i, apply: d => ({ ...d, ing: [...d.ing, g] }) }));
      seq.push({ i, apply: d => ({ ...d, diet: p.diet, heaviness: p.heaviness }) });
      if (p.places) {
        seq.push({ i, apply: d => ({ ...d, hasLocation: true, placeLoading: true }) });
        seq.push({ i, apply: d => ({ ...d, places: p.places as string[], placeLoading: false }) });
      } else {
        seq.push({ i, apply: d => ({ ...d, hasLocation: false }) });
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
  const choose = (i: number, place: string) => { setDishes(prev => prev.map((d, j) => (j === i ? { ...d, choice: place } : d))); absorb('✓', 2.5); };
  const startEdit = (i: number, cur: string) => { setEditIdx(i); setEditVal(cur); };
  const commitEdit = () => {
    if (editIdx === null) return;
    const i = editIdx, v = editVal.trim();
    if (v) { setNames(prev => prev.map((n, j) => (j === i ? v : n))); absorb(v, 2.5); }
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
        <p className="grow2-sub">{t('grow.refine.ask')}</p>

        <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(fill)}><div className="xp-fill" style={{ width: `${fill}%` }} /></div>
        <p className="grow2-unlock">{fill >= 100 ? t('rate.grow.unlocked') : t('rate.grow.remain', { p: remain })}</p>
      </div>

      <ul className="learn-list">
        {items.map((it, i) => {
          const d = dishes[i];
          const p = POOL[i % POOL.length];
          const zh = names[i] ?? p.zh;
          const showPlace = d.placeLoading || d.places.length > 0 || (d.done && !d.hasLocation);
          return (
            <li key={i} className={`learn-row ${d.done ? 'is-done' : 'is-working'}`}>
              <div className="learn-thumb">
                {it.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={it.photoUrl} alt="" />
                  : <span>🍽️</span>}
              </div>
              <div className="learn-main">
                <div className="learn-head">
                  {!d.named
                    ? <span className="learn-name learn-skel">{t('grow.analysing')}</span>
                    : editIdx === i
                      ? <input className="learn-edit field" value={editVal} autoFocus
                          onChange={e => setEditVal(e.target.value)} onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditIdx(null); }} />
                      : <button className="learn-namebtn" onClick={() => startEdit(i, zh)} aria-label={t('grow.rename')}>
                          <DishName name={p.en} name_zh={zh} size="md" />
                          <span className="learn-editicon" aria-hidden>✎</span>
                        </button>}
                  <span className="learn-word">{t(wordKeyFor(it.score))}</span>
                </div>

                {(d.ing.length > 0 || d.diet.length > 0) && (
                  <DishInfoDisplay info={{ ingredients: d.ing, diet: d.diet, heaviness: d.heaviness }} hideHook compact />
                )}

                {showPlace && (
                  <div className="chips learn-place">
                    {d.placeLoading && d.places.length === 0 && <span className="learn-finding">{t('grow.finding')}</span>}
                    {d.places.map(pl => (
                      <button key={pl} className={`chip ${d.choice === pl ? 'on' : ''}`} onClick={() => choose(i, pl)}>{pl}</button>
                    ))}
                    {(d.places.length > 0 || (d.done && !d.hasLocation)) && (
                      <button className={`chip chip-util ${d.choice === t('place.home') ? 'on' : ''}`} onClick={() => choose(i, t('place.home'))}>{t('place.home')}</button>
                    )}
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
