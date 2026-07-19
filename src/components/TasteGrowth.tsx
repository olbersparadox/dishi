'use client';
// The reward + light review, MERGED (rating-flow revamp). You land here and WATCH
// your Taste AI learn — data STREAMS in like a response: each dish expands piece by
// piece (bilingual name → ingredient/diet chips → all the nearby restaurants). The
// taste qualities it LEARNS fly INTO the ink blob and are absorbed, growing it. The
// confidence bar + blob grow only on real learning, never the raw rating count.
// Wrong guesses are correctable in place (confirm the restaurant / home-cooked).
//
// Uses the app's real DishName (bilingual) + DishInfoDisplay (icon chips) so the
// mock matches production. DEMO NOTE: enrichment is SIMULATED on a staggered event
// timeline — no real EXIF / vision. The real version drives these off background prep.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { wordKeyFor } from '@/lib/flickWords';
import DishName from '@/components/DishName';
import DishInfoDisplay from '@/components/DishInfoDisplay';

export type GrowItem = { photoUrl: string | null; score: number };

type Dish = {
  named: boolean;
  ing: string[];              // english (DishInfoDisplay maps → icon + zh label)
  diet: string[];
  heaviness?: string;
  places: string[];
  placeLoading: boolean;
  hasLocation: boolean;
  choice?: string;
  done: boolean;
};

// Stand-in for vision + EXIF. Ingredients are the english keys DishInfoDisplay
// iconifies; `places` is "every eatery near where the photo was taken" (8–10).
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
  const [fill, setFill] = useState(BASE);
  const [absorbed, setAbsorbed] = useState(0); // learned qualities the blob has eaten
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const flyId = useRef(0);

  // Streaming timeline: name → ingredients → diet/heaviness → find + list restaurants
  // → learned qualities (each flies into the blob). Each event bumps the bar.
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
        if (ev.learn) {
          const ang = Math.random() * Math.PI * 2, rad = 72 + Math.random() * 40;
          const id = ++flyId.current;
          const fl: Flyer = { id, word: ev.learn, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.68 };
          setFlyers(prev => [...prev, fl]);
          setAbsorbed(a => a + 1);
          timers.push(window.setTimeout(() => setFlyers(prev => prev.filter(f => f.id !== id)), 900));
        }
        n += 1; setFill(Math.min(CAP, BASE + n * per));
      }, ev.at));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = dishes.filter(d => d.done).length;
  const allDone = doneCount === items.length;
  const remain = Math.max(0, Math.round(100 - fill));
  const blobScale = 0.72 + Math.min(absorbed, 14) * 0.045; // grows as qualities are absorbed

  const choose = (i: number, place: string) => setDishes(prev => prev.map((d, j) => (j === i ? { ...d, choice: place } : d)));

  return (
    <div className="grow2">
      <div className="grow2-top">
        <div className="grow-blobwrap">
          {flyers.map(f => (
            <span key={f.id} className="blob-flyer"
              style={{ ['--x' as string]: `${f.x}px`, ['--y' as string]: `${f.y}px` } as React.CSSProperties}>
              {f.word}
            </span>
          ))}
          <div className="grow-blob" style={{ transform: `scale(${blobScale.toFixed(3)})` }} aria-hidden>
            <svg viewBox="0 0 100 100" width="66" height="66">
              <path d="M50 6 C71 6 92 20 93 44 C94 68 79 92 53 94 C29 96 9 81 7 55 C5 30 27 6 50 6 Z" fill="var(--ink)" />
            </svg>
          </div>
        </div>
        <h2 className="grow2-title">{allDone ? t('grow.done.title') : t('grow.work.title')}</h2>
        <p className="grow2-sub">{allDone ? t('grow.done.sub', { n: items.length }) : t('grow.work.sub', { done: doneCount, n: items.length })}</p>
        <div className="grow-barwrap">
          <div className="grow-level">{t('rate.grow.level', { n: 3 })}</div>
          <div className="grow-bar"><span className="grow-fill" style={{ width: `${fill}%` }} /></div>
          <p className="card-meta grow-unlock">{fill >= 100 ? t('rate.grow.unlocked') : t('rate.grow.remain', { p: remain })}</p>
        </div>
      </div>

      <ul className="learn-list">
        {items.map((it, i) => {
          const d = dishes[i];
          const p = POOL[i % POOL.length];
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
                  {d.named
                    ? <DishName name={p.en} name_zh={p.zh} size="md" />
                    : <span className="learn-name learn-skel">{t('grow.analysing')}</span>}
                  <span className="learn-word">{t(wordKeyFor(it.score))}</span>
                </div>

                {(d.ing.length > 0 || d.diet.length > 0) && (
                  <DishInfoDisplay info={{ ingredients: d.ing, diet: d.diet, heaviness: d.heaviness }} hideHook compact />
                )}

                {showPlace && (
                  <div className="learn-place">
                    {d.placeLoading && d.places.length === 0 && <span className="learn-finding">{t('grow.finding')}</span>}
                    {d.places.map(pl => (
                      <button key={pl} className={`learn-chip ${d.choice === pl ? 'on' : ''}`} onClick={() => choose(i, pl)}>{pl}</button>
                    ))}
                    {(d.places.length > 0 || (d.done && !d.hasLocation)) && (
                      <button className={`learn-chip ${d.choice === t('place.home') ? 'on' : ''}`} onClick={() => choose(i, t('place.home'))}>{t('place.home')}</button>
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
