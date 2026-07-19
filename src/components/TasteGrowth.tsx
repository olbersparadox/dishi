'use client';
// The REWARD, delivered only AFTER consent — the core incentive of the whole flow.
//
// The frame is never "dish saved"; it's "you just made your Taste AI smarter for
// you." Confirming a batch animates the engine-confidence bar (the same buddy bar
// as palate §2) forward — level-ups and creeping toward the persona-export UNLOCK.
// Rating → levelling → the AI merge become one loop.
//
// Pure presentation: the parent computes taught/from/to/level and owns "done".
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';

export default function TasteGrowth({ taught, fromPct, toPct, level, onDone }: {
  taught: number;
  fromPct: number;   // engine confidence before this batch (0–100)
  toPct: number;     // …and after
  level: number;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [fill, setFill] = useState(fromPct);
  // paint at fromPct, then on the next frame ease to toPct so the bar visibly grows.
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFill(toPct)));
    return () => cancelAnimationFrame(id);
  }, [toPct]);

  const unlocked = toPct >= 100;
  const remain = Math.max(0, Math.round(100 - toPct));

  return (
    <div className="grow">
      <div className="grow-spark" aria-hidden>✦</div>
      <h2 className="grow-title">{t('rate.grow.title')}</h2>
      <p className="grow-taught">{t('rate.grow.taught', { n: taught })}</p>

      <div className="grow-barwrap">
        <div className="grow-level">{t('rate.grow.level', { n: level })}</div>
        <div className="grow-bar"><span className="grow-fill" style={{ width: `${fill}%` }} /></div>
        <p className="card-meta grow-unlock">
          {unlocked ? t('rate.grow.unlocked') : t('rate.grow.remain', { p: remain })}
        </p>
      </div>

      <button className="btn primary grow-done" onClick={onDone}>{t('rate.grow.done')}</button>
    </div>
  );
}
