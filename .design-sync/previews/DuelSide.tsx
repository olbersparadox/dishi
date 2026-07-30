import { DuelSide } from 'dishi';

// DuelSide is the shared side-anatomy of every two-dish comparison card, and
// it is never mounted bare: each cell reproduces the real chassis — the warm
// .duel-card, then .duel-pair's two-column grid, with each side wrapped the
// way its caller wraps it (a tappable <button class="duel-option"> in a 對決,
// a static .identity-side div on the 係咪同一味 card). Names read 中文 primary
// by the component's own forced pair — that pinning is the point of the
// side-by-side comparison, so no `pair` override here.

const svgUri = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
const plate = (food: string, bits: string, t1 = '#4a3627', t2 = '#241a12') => svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>` +
  `<defs><radialGradient id='t' cx='0.3' cy='0.15' r='1.2'><stop offset='0' stop-color='${t1}'/><stop offset='1' stop-color='${t2}'/></radialGradient>` +
  `<radialGradient id='f' cx='0.45' cy='0.4' r='0.8'>${food}</radialGradient></defs>` +
  `<rect width='400' height='300' fill='url(#t)'/>` +
  `<ellipse cx='203' cy='170' rx='150' ry='112' fill='#0e0a06' opacity='0.42'/>` +
  `<ellipse cx='200' cy='160' rx='146' ry='108' fill='#f1ebdd'/>` +
  `<ellipse cx='200' cy='157' rx='126' ry='90' fill='#e6ddc8'/>` +
  `<ellipse cx='200' cy='154' rx='104' ry='72' fill='url(#f)'/>` + bits +
  `<ellipse cx='164' cy='127' rx='40' ry='15' fill='#fff' opacity='0.15'/></svg>`,
);

// Stand-in photos (offline capture can't fetch real JPEGs) — warm and
// food-shaped so the 4:3 crop is judged against photo-like content.
const CHOW_FUN = plate(
  `<stop offset='0' stop-color='#d9ab5e'/><stop offset='0.6' stop-color='#a97a38'/><stop offset='1' stop-color='#7a5426'/>`,
  `<path d='M108 156 C152 118 254 126 292 158' stroke='#e3b569' stroke-width='8' fill='none' stroke-linecap='round'/>` +
  `<path d='M116 174 C162 142 244 148 286 176' stroke='#caa04f' stroke-width='8' fill='none' stroke-linecap='round'/>` +
  `<path d='M124 140 C172 110 238 118 280 146' stroke='#d9a854' stroke-width='7' fill='none' stroke-linecap='round'/>` +
  `<ellipse cx='168' cy='150' rx='23' ry='11' fill='#6a4325' transform='rotate(-14 168 150)'/>` +
  `<ellipse cx='236' cy='166' rx='22' ry='11' fill='#74492a' transform='rotate(9 236 166)'/>` +
  `<path d='M188 166 l16 -4' stroke='#6d8f4a' stroke-width='4' stroke-linecap='round'/>`,
);
const SQUID = plate(
  `<stop offset='0' stop-color='#e2bb6d'/><stop offset='0.6' stop-color='#c3924a'/><stop offset='1' stop-color='#8f6630'/>`,
  `<g fill='#e8c276' stroke='#a87c3c' stroke-width='2'>` +
  `<ellipse cx='168' cy='142' rx='20' ry='13' transform='rotate(-18 168 142)'/>` +
  `<ellipse cx='214' cy='134' rx='18' ry='12' transform='rotate(12 214 134)'/>` +
  `<ellipse cx='246' cy='160' rx='21' ry='13' transform='rotate(-8 246 160)'/>` +
  `<ellipse cx='182' cy='176' rx='19' ry='12' transform='rotate(20 182 176)'/>` +
  `<ellipse cx='224' cy='182' rx='17' ry='11' transform='rotate(-14 224 182)'/></g>` +
  `<circle cx='176' cy='138' r='1.6' fill='#3d2c14'/><circle cx='220' cy='130' r='1.6' fill='#3d2c14'/>` +
  `<circle cx='250' cy='156' r='1.6' fill='#3d2c14'/><circle cx='190' cy='180' r='1.6' fill='#3d2c14'/>` +
  `<ellipse cx='204' cy='158' rx='7' ry='4' fill='#b34a2a' transform='rotate(24 204 158)'/>` +
  `<path d='M234 148 l14 -4' stroke='#7a9c55' stroke-width='4' stroke-linecap='round'/>`,
);
const CHICKEN = plate(
  `<stop offset='0' stop-color='#f2debc'/><stop offset='0.6' stop-color='#e8cb97'/><stop offset='1' stop-color='#cfa967'/>`,
  `<g fill='#f4e3c2' stroke='#dcae6b' stroke-width='2'>` +
  `<rect x='138' y='128' width='52' height='26' rx='12' transform='rotate(-12 164 141)'/>` +
  `<rect x='176' y='140' width='52' height='26' rx='12' transform='rotate(-4 202 153)'/>` +
  `<rect x='214' y='152' width='52' height='26' rx='12' transform='rotate(6 240 165)'/></g>` +
  `<ellipse cx='262' cy='126' rx='16' ry='10' fill='#9db661'/>` +
  `<circle cx='258' cy='124' r='2.5' fill='#c7d69a'/><circle cx='268' cy='129' r='2.5' fill='#c7d69a'/>`,
  '#54402c', '#32261a',
);
const GUNKAN = plate(
  `<stop offset='0' stop-color='#efe9dc'/><stop offset='1' stop-color='#d8cfba'/>`,
  `<rect x='138' y='126' width='58' height='44' rx='16' fill='#1d1a17'/>` +
  `<ellipse cx='167' cy='128' rx='27' ry='12' fill='#e8862e'/>` +
  `<circle cx='156' cy='126' r='4' fill='#f59b3d'/><circle cx='168' cy='130' r='4' fill='#f7a94e'/><circle cx='178' cy='125' r='4' fill='#f59b3d'/>` +
  `<rect x='210' y='140' width='58' height='44' rx='16' fill='#201d19'/>` +
  `<ellipse cx='239' cy='142' rx='27' ry='12' fill='#d9a03a'/>` +
  `<path d='M224 140 q7 -6 14 0 q7 6 14 0' stroke='#b97f22' stroke-width='3' fill='none'/>`,
  '#2e2a26', '#191613',
);
const NIGIRI = plate(
  `<stop offset='0' stop-color='#f3ede0'/><stop offset='1' stop-color='#ddd3bd'/>`,
  `<ellipse cx='176' cy='156' rx='38' ry='18' fill='#f6f1e4' stroke='#dccfb2' stroke-width='2'/>` +
  `<rect x='142' y='128' width='72' height='30' rx='14' fill='#ef8c56' transform='rotate(-6 178 143)'/>` +
  `<path d='M150 140 l60 -6 M154 150 l58 -6' stroke='#f8b48c' stroke-width='3'/>` +
  `<ellipse cx='248' cy='168' rx='36' ry='17' fill='#f6f1e4' stroke='#dccfb2' stroke-width='2'/>` +
  `<rect x='216' y='142' width='68' height='28' rx='13' fill='#f19a63' transform='rotate(5 250 156)'/>`,
  '#2e2a26', '#191613',
);

const CWB = { zh: '銅鑼灣', en: 'Causeway Bay' };

/** 對決 (the shipped duel): two rated dishes side by side, each side a
 *  tappable .duel-option — tapping means "I prefer this". */
export function DuelPair() {
  return (
    <div className="card duel-card" style={{ maxWidth: 420 }}>
      <div className="card-body">
        <div className="duel-pair">
          <button type="button" className="duel-option">
            <DuelSide dish={{ id: 'd1', name: 'Beef Chow Fun', name_zh: '乾炒牛河', photo_url: CHOW_FUN, restaurant: '榮記茶餐廳', restaurant_district: { zh: '深水埗', en: 'Sham Shui Po' } }} />
          </button>
          <button type="button" className="duel-option">
            <DuelSide dish={{ id: 'd2', name: 'Salt and Pepper Squid', name_zh: '椒鹽鮮魷', photo_url: SQUID, restaurant: '陳記海鮮', restaurant_district: { zh: '西貢', en: 'Sai Kung' } }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 係咪同一味？ — the identity-confirm card mounts the SAME anatomy in a
 *  deliberately non-tappable .identity-side div (duel muscle memory must not
 *  merge two dishes by accident). Two names at one restaurant that might be
 *  the same dish; the second was picked off a menu and never photographed, so
 *  its photo slot is the blank block. */
export function IdentityConfirmPair() {
  return (
    <div className="card duel-card" style={{ maxWidth: 420 }}>
      <div className="card-body">
        <div className="duel-pair">
          <div className="duel-option identity-side">
            <DuelSide dish={{ id: 'd3', name: 'Poached Chicken', name_zh: '白切雞', photo_url: CHICKEN, restaurant: '華香雞飯店', restaurant_district: { zh: '旺角', en: 'Mong Kok' } }} />
          </div>
          <div className="duel-option identity-side">
            <DuelSide dish={{ id: 'd4', name: 'White Cut Chicken', name_zh: '白斬雞', photo_url: null, restaurant: '華香雞飯店', restaurant_district: { zh: '旺角', en: 'Mong Kok' } }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The measured worst case for the narrow side column: an 11-character 中文
 *  primary (三文魚卵及海膽軍艦壽司) shrinks 1px at a time until it fits two
 *  lines — never truncated, the whole name must still read — while the short
 *  name beside it keeps the base size. */
export function LongNameShrink() {
  return (
    <div className="card duel-card" style={{ maxWidth: 420 }}>
      <div className="card-body">
        <div className="duel-pair">
          <button type="button" className="duel-option">
            <DuelSide dish={{ id: 'd5', name: 'Salmon Roe and Sea Urchin Gunkan', name_zh: '三文魚卵及海膽軍艦壽司', photo_url: GUNKAN, restaurant: '板長壽司', restaurant_district: CWB }} />
          </button>
          <button type="button" className="duel-option">
            <DuelSide dish={{ id: 'd6', name: 'Salmon Nigiri', name_zh: '三文魚壽司', photo_url: NIGIRI, restaurant: '板長壽司', restaurant_district: CWB }} />
          </button>
        </div>
      </div>
    </div>
  );
}
