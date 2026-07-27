'use client';
// The scan banner's right side: a rotating miniature of what a menu scan RETURNS —
// a foreign dish name translated into the reader's language over the ORIGINAL menu
// text (a different script each cycle, quietly selling "any-language menus"), the
// ingredient/allergen chips, and dishi's personalised pick. Showcase data, NOT real
// dishes — it demonstrates the payoff instead of describing the mechanics.
//
// Rotation pauses under prefers-reduced-motion (first dish shown statically); the
// key={i} remount re-fires the CSS fade each cycle.
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';

type Demo = { zh: string; en: string; sub: string; chips: [string, string][] };

// Ingredient chip WORDS (not the dish itself) are picked short enough that the
// English chip row — 2 ingredient chips + the "✓ your match" chip — fits on one
// line at the app's standard width. English words run longer than their zh/
// original-script counterparts, so a pairing that's fine in zh (e.g. 蝦/香茅)
// can overflow to a second line in en (prawn/lemongrass) even though the row is
// the same flex-wrap container for both languages — each language just picks
// its own two (still authentic) ingredients for the same dish.
const DEMO: Demo[] = [
  { zh: '豚骨拉麵', en: 'Tonkotsu ramen', sub: 'とんこつラーメン', chips: [['豬', 'pork'], ['蛋', 'egg']] },
  { zh: '冬蔭功湯', en: 'Tom yum goong', sub: 'ต้มยำกุ้ง', chips: [['青檸', 'lime'], ['辣椒', 'chili']] },
  { zh: '西班牙海鮮飯', en: 'Seafood paella', sub: 'Paella de marisco', chips: [['飯', 'rice'], ['蜆', 'clam']] },
  { zh: '部隊鍋', en: 'Army stew', sub: '부대찌개', chips: [['火腿', 'ham'], ['蛋', 'egg']] },
];

const ROTATE_MS = 2800;

export default function ScanBenefitDemo() {
  const { t, lang } = useLang();
  const [i, setI] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setAnimate(true);
    const id = setInterval(() => setI(n => (n + 1) % DEMO.length), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const d = DEMO[i];
  return (
    <span className="scan-benefit">
      <span className={`scan-benefit-swap ${animate ? 'on' : ''}`} key={i}>
        <span className="scan-benefit-name">{lang === 'zh' ? d.zh : d.en}</span>
        <span className="scan-benefit-sub">{d.sub}</span>
        <span className="scan-benefit-chips">
          {d.chips.map(([zh, en]) => (
            <span className="scan-benefit-chip" key={en}>{lang === 'zh' ? zh : en}</span>
          ))}
          <span className="scan-benefit-chip rec">✓ {t('scan.benefit.rec')}</span>
        </span>
      </span>
    </span>
  );
}
