'use client';
// The reward + light review, MERGED (rating-flow revamp). You land here and WATCH
// your Taste AI learn — data STREAMS in like a response: each dish expands piece by
// piece (name → ingredient chips → all the nearby restaurants). The taste qualities
// it LEARNS float up as an aura around the ink blob at the top, and the confidence
// bar + blob grow on every real piece — never on the raw rating count, so it's honest.
// Wrong guesses are correctable in place (confirm the restaurant / home-cooked).
//
// DEMO NOTE: enrichment is SIMULATED as a staggered event timeline — no real EXIF /
// vision here. The real version drives these off the background-prep pipeline.
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { wordKeyFor } from '@/lib/flickWords';

export type GrowItem = { photoUrl: string | null; score: number };

type Dish = {
  name?: string;
  ing: string[];
  places: string[];      // ALL nearby restaurants (arrive together after the lookup)
  placeLoading: boolean;
  hasLocation: boolean;  // false → no GPS, home-cooked only
  learned: string[];
  choice?: string;
  done: boolean;
};

// Stand-in for the vision + EXIF results the real pipeline will produce. `places` is
// "every eatery near where the photo was taken" — realistically 8–10.
const POOL: { name: string; ing: string[]; learned: string[]; places: string[] | null }[] = [
  { name: '叉燒飯', ing: ['叉燒', '白飯', '豉油', '葱花'], learned: ['鮮味', '油香', '鹹'],
    places: ['大家樂（銅鑼灣）', '翠華餐廳', '太興', '東海堂', '再興燒臘', '一樂燒鵝', '華姐清湯腩', '甘牌燒鵝', '鏞記酒家', '敏華冰廳'] },
  { name: '豚骨拉麵', ing: ['豚骨湯', '溏心蛋', '叉燒', '海苔', '木耳'], learned: ['濃郁', '鹹鮮', '油'],
    places: ['一蘭', '豚王', '麵屋一燈', '山頭火', '一風堂', '花丸烏冬', '拉麵Jo', '鵬天', '梅光軒'] },
  { name: '紐約芝士蛋糕', ing: ['忌廉芝士', '餅乾底', '檸檬'], learned: ['香甜', '奶香', '微酸'], places: null },
  { name: '水晶蝦餃', ing: ['鮮蝦', '蝦餃皮', '筍粒'], learned: ['鮮甜', '煙韌'],
    places: ['添好運', '點心到（中環）', '倫敦大酒樓', '稻香', '一點心', '明閣', '龍景軒', '陸羽茶室', '鴻星海鮮', '嘉麟樓'] },
  { name: '牛油果沙律', ing: ['牛油果', '沙律菜', '車厘茄', '檸檬汁'], learned: ['清新', 'creamy'], places: null },
];

// scattered anchor points around the blob for the learned-taste aura
const AURA_POS = [
  { x: -96, y: -18 }, { x: 92, y: -14 }, { x: -72, y: 36 }, { x: 80, y: 34 },
  { x: -108, y: 10 }, { x: 104, y: 12 }, { x: -44, y: -52 }, { x: 56, y: -50 },
  { x: -60, y: 62 }, { x: 66, y: 60 }, { x: -2, y: -72 }, { x: 8, y: 74 },
];

const BASE = 38;
const CAP = 96;
const emptyDish = (): Dish => ({ ing: [], places: [], placeLoading: false, hasLocation: false, learned: [], done: false });
const dedupe = (arr: string[]) => Array.from(new Set(arr));

export default function TasteGrowth({ items, onExit }: { items: GrowItem[]; onExit: () => void }) {
  const { t } = useLang();
  const [dishes, setDishes] = useState<Dish[]>(() => items.map(emptyDish));
  const [fill, setFill] = useState(BASE);

  // Streaming timeline: name → ingredients (one by one) → find + list nearby restaurants
  // → learned qualities (one by one). Each event bumps the bar (+ the blob).
  useEffect(() => {
    type Ev = { i: number; apply: (d: Dish) => Dish; at: number };
    const evs: Ev[] = [];
    items.forEach((_, i) => {
      const p = POOL[i % POOL.length];
      const seq: ((d: Dish) => Dish)[] = [];
      seq.push(d => ({ ...d, name: p.name }));
      p.ing.forEach(g => seq.push(d => ({ ...d, ing: [...d.ing, g] })));
      if (p.places) {
        seq.push(d => ({ ...d, hasLocation: true, placeLoading: true }));
        seq.push(d => ({ ...d, places: p.places as string[], placeLoading: false })); // full list at once
      } else {
        seq.push(d => ({ ...d, hasLocation: false }));
      }
      p.learned.forEach(l => seq.push(d => ({ ...d, learned: [...d.learned, l] })));
      seq.push(d => ({ ...d, done: true }));
      seq.forEach((apply, k) => evs.push({ i, apply, at: 450 + i * 400 + k * 400 + Math.random() * 150 }));
    });
    const per = (CAP - BASE) / evs.length;
    let n = 0;
    const timers = evs.map(ev => window.setTimeout(() => {
      setDishes(prev => prev.map((d, j) => (j === ev.i ? ev.apply(d) : d)));
      n += 1; setFill(Math.min(CAP, BASE + n * per));
    }, ev.at));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = dishes.filter(d => d.done).length;
  const allDone = doneCount === items.length;
  const remain = Math.max(0, Math.round(100 - fill));
  const blobScale = 0.66 + ((fill - BASE) / (100 - BASE)) * 0.5;
  const aura = dedupe(dishes.flatMap(d => d.learned)).slice(0, AURA_POS.length);

  const choose = (i: number, place: string) => setDishes(prev => prev.map((d, j) => (j === i ? { ...d, choice: place } : d)));

  return (
    <div className="grow2">
      <div className="grow2-top">
        <div className="grow-blobwrap">
          {aura.map((w, i) => (
            <span key={w} className="grow-aura-word"
              style={{ ['--x' as string]: `${AURA_POS[i].x}px`, ['--y' as string]: `${AURA_POS[i].y}px` } as React.CSSProperties}>
              {w}
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
                <div className="learn-titleline">
                  <span className={`learn-name ${d.name ? '' : 'learn-skel'}`}>{d.name ?? t('grow.analysing')}</span>
                  <span className="learn-word">· {t(wordKeyFor(it.score))}</span>
                </div>

                {d.ing.length > 0 && (
                  <div className="learn-chips">
                    {d.ing.map(g => <span key={g} className="learn-tag">{g}</span>)}
                  </div>
                )}

                {showPlace && (
                  <div className="learn-place">
                    {d.placeLoading && d.places.length === 0 && <span className="learn-finding">{t('grow.finding')}</span>}
                    {d.places.map(p => (
                      <button key={p} className={`learn-chip ${d.choice === p ? 'on' : ''}`} onClick={() => choose(i, p)}>{p}</button>
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
