'use client';
// The reward + light review, MERGED (rating-flow revamp). After the flick stack you
// land here and WATCH your Taste AI learn — dish by dish, as each one's data lands
// (place from EXIF, dish name / ingredients / attributes from vision). The confidence
// bar only moves on a REAL learning event (a dish resolving), never on the raw rating
// count — so the growth is always honest. Wrong guesses are correctable right here
// (confirm the restaurant, or "home cooked"); anything still processing finishes in
// the background and a notification says when all N are done.
//
// DEMO NOTE: enrichment is SIMULATED on staggered timers — there is no real EXIF /
// vision here. The real version drives these rows off the background-prep pipeline.
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { wordKeyFor } from '@/lib/flickWords';

export type GrowItem = { photoUrl: string | null; score: number };

type Enriched = {
  done: boolean;
  name?: string; ing?: string[]; learned?: string[];
  places?: string[] | null; // nearby restaurants from EXIF; null = no location found
  choice?: string;          // the restaurant / home-cooked the user confirmed
};

// Stand-in for the vision + EXIF results the real pipeline will produce.
const POOL: { name: string; ing: string[]; learned: string[]; places: string[] | null }[] = [
  { name: '叉燒飯', ing: ['叉燒', '白飯', '豉油'], learned: ['鮮味', '油香'], places: ['大家樂（銅鑼灣）', '翠華餐廳'] },
  { name: '豚骨拉麵', ing: ['豚骨湯', '溏心蛋', '叉燒'], learned: ['濃郁', '鹹鮮'], places: ['一蘭', '豚王'] },
  { name: '紐約芝士蛋糕', ing: ['忌廉芝士', '餅乾底'], learned: ['香甜', '奶香'], places: null },
  { name: '水晶蝦餃', ing: ['鮮蝦', '蝦餃皮'], learned: ['鮮甜', '煙韌'], places: ['添好運', '點心到（中環）'] },
  { name: '牛油果沙律', ing: ['牛油果', '沙律菜', '檸檬'], learned: ['清新', 'creamy'], places: null },
];

const BASE = 40;  // starting confidence
const STEP = 9;   // each dish that actually resolves nudges the bar

export default function TasteGrowth({ items, onExit }: { items: GrowItem[]; onExit: () => void }) {
  const { t } = useLang();
  const [enr, setEnr] = useState<Enriched[]>(() => items.map(() => ({ done: false })));
  const [fill, setFill] = useState(BASE);

  // Enrichment lands per-dish on staggered timers; the bar bumps on each real resolve.
  useEffect(() => {
    const timers = items.map((_, i) => window.setTimeout(() => {
      const p = POOL[i % POOL.length];
      setEnr(prev => prev.map((e, j) => j === i
        ? { done: true, name: p.name, ing: p.ing, learned: p.learned, places: p.places }
        : e));
      setFill(f => Math.min(100, f + STEP));
    }, 900 + i * 1250 + Math.random() * 500));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = enr.filter(e => e.done).length;
  const allDone = doneCount === items.length;
  const remain = Math.max(0, Math.round(100 - fill));

  const choose = (i: number, place: string) =>
    setEnr(prev => prev.map((e, j) => (j === i ? { ...e, choice: place } : e)));

  return (
    <div className="grow2">
      <div className="grow2-top">
        <div className="grow-spark" aria-hidden>✦</div>
        <h2 className="grow2-title">{allDone ? t('grow.done.title') : t('grow.work.title')}</h2>
        <p className="grow2-sub">
          {allDone ? t('grow.done.sub', { n: items.length }) : t('grow.work.sub', { done: doneCount, n: items.length })}
        </p>
        <div className="grow-barwrap">
          <div className="grow-level">{t('rate.grow.level', { n: 3 })}</div>
          <div className="grow-bar"><span className="grow-fill" style={{ width: `${fill}%` }} /></div>
          <p className="card-meta grow-unlock">{fill >= 100 ? t('rate.grow.unlocked') : t('rate.grow.remain', { p: remain })}</p>
        </div>
      </div>

      <ul className="learn-list">
        {items.map((it, i) => {
          const e = enr[i];
          return (
            <li key={i} className={`learn-row ${e.done ? 'is-done' : 'is-working'}`}>
              <div className="learn-thumb">
                {it.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={it.photoUrl} alt="" />
                  : <span>🍽️</span>}
              </div>
              <div className="learn-main">
                {!e.done ? (
                  <>
                    <span className="learn-name learn-skel">{t('grow.analysing')}</span>
                    <span className="learn-word">{t(wordKeyFor(it.score))}</span>
                  </>
                ) : (
                  <>
                    <div className="learn-titleline">
                      <span className="learn-name">{e.name}</span>
                      <span className="learn-word">· {t(wordKeyFor(it.score))}</span>
                    </div>
                    <span className="learn-ing">{e.ing?.join(' · ')}</span>
                    <span className="learn-learned">{t('grow.learned')}：{e.learned?.join(' · ')}</span>
                    {/* light correction: confirm the restaurant EXIF found, or home-cooked */}
                    <div className="learn-place">
                      {(e.places ?? []).map(p => (
                        <button key={p} className={`learn-chip ${e.choice === p ? 'on' : ''}`} onClick={() => choose(i, p)}>{p}</button>
                      ))}
                      <button className={`learn-chip ${e.choice === t('place.home') ? 'on' : ''}`} onClick={() => choose(i, t('place.home'))}>{t('place.home')}</button>
                    </div>
                  </>
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
