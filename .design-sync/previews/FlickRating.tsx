import { FlickRating } from 'dishi';

// The flick surface is pointer-driven, so a static card can only show the REST
// state: the photo with the gauge + arrows, the centre "how to" pill, and the
// full tap-chip scale beneath — which is exactly the state a person sees
// before their first flick, and the state that teaches the rating vocabulary.
// Dragged/rated states are internal and not composable from props. The
// photoUrl=null name surface is deliberately NOT shown: at rest the centred
// hint pill lands exactly on the centred dish name and the two are illegible
// together (the component's own behaviour, not a composition choice — see
// learnings); the .flick-nophoto surface itself is taught by SnapRating's
// PickWithoutPhoto cell, where it renders clean.

// Stand-in dish photo (inline SVG data URI): capture runs offline, so a real
// JPEG can't be fetched — this stays warm and food-shaped so the photo-overlay
// chrome (gauge, arrows, hint pill) is judged against photo-like content, not
// a grey block.
const svgUri = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
const CHOW_FUN = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>` +
  `<defs><radialGradient id='t' cx='0.3' cy='0.15' r='1.2'><stop offset='0' stop-color='#4a3627'/><stop offset='1' stop-color='#241a12'/></radialGradient>` +
  `<radialGradient id='f' cx='0.45' cy='0.4' r='0.8'><stop offset='0' stop-color='#d9ab5e'/><stop offset='0.6' stop-color='#a97a38'/><stop offset='1' stop-color='#7a5426'/></radialGradient></defs>` +
  `<rect width='400' height='300' fill='url(#t)'/>` +
  `<ellipse cx='203' cy='170' rx='154' ry='114' fill='#0e0a06' opacity='0.45'/>` +
  `<ellipse cx='200' cy='160' rx='150' ry='110' fill='#f1ebdd'/>` +
  `<ellipse cx='200' cy='158' rx='131' ry='94' fill='#e6ddc8'/>` +
  `<ellipse cx='200' cy='155' rx='108' ry='74' fill='url(#f)'/>` +
  `<path d='M104 158 C150 118 258 126 296 160' stroke='#e3b569' stroke-width='8' fill='none' stroke-linecap='round' opacity='0.9'/>` +
  `<path d='M112 174 C160 140 246 146 290 176' stroke='#caa04f' stroke-width='8' fill='none' stroke-linecap='round' opacity='0.9'/>` +
  `<path d='M120 142 C170 108 240 116 284 146' stroke='#d9a854' stroke-width='7' fill='none' stroke-linecap='round' opacity='0.85'/>` +
  `<path d='M126 188 C176 162 236 166 276 190' stroke='#e0b264' stroke-width='7' fill='none' stroke-linecap='round' opacity='0.85'/>` +
  `<ellipse cx='166' cy='150' rx='24' ry='12' fill='#6a4325' transform='rotate(-14 166 150)'/>` +
  `<ellipse cx='238' cy='168' rx='23' ry='11' fill='#74492a' transform='rotate(9 238 168)'/>` +
  `<ellipse cx='206' cy='132' rx='20' ry='10' fill='#5f3b20' transform='rotate(-5 206 132)'/>` +
  `<path d='M150 172 l26 -8' stroke='#f4e9cf' stroke-width='3.5' stroke-linecap='round'/>` +
  `<path d='M226 148 l24 6' stroke='#efe2c4' stroke-width='3.5' stroke-linecap='round'/>` +
  `<path d='M186 164 l16 -4' stroke='#6d8f4a' stroke-width='4' stroke-linecap='round'/>` +
  `<path d='M218 182 l14 -5' stroke='#7a9c55' stroke-width='4' stroke-linecap='round'/>` +
  `<ellipse cx='162' cy='126' rx='42' ry='16' fill='#fff' opacity='0.14'/>` +
  `<circle cx='330' cy='60' r='26' fill='#fff' opacity='0.05'/></svg>`,
);

/** The common case: a photographed dish at rest — gauge and arrows on the
 *  right edge of the photo, the gesture hint centred, and the full six-word
 *  tap scale beneath so the vocabulary (and bidirectionality) is visible
 *  before the first flick. */
export function PhotoAtRest() {
  return (
    <div style={{ maxWidth: 340 }}>
      <FlickRating photoUrl={CHOW_FUN} dishName="Beef Chow Fun" dishNameZh="乾炒牛河" onRate={() => {}} />
    </div>
  );
}

// A bright plate (白切雞) — the other end of the photography the overlay
// chrome has to survive.
const CHICKEN = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>` +
  `<defs><radialGradient id='t' cx='0.3' cy='0.15' r='1.2'><stop offset='0' stop-color='#8a7355'/><stop offset='1' stop-color='#5d4b35'/></radialGradient>` +
  `<radialGradient id='f' cx='0.45' cy='0.4' r='0.8'><stop offset='0' stop-color='#f2debc'/><stop offset='0.6' stop-color='#e8cb97'/><stop offset='1' stop-color='#cfa967'/></radialGradient></defs>` +
  `<rect width='400' height='300' fill='url(#t)'/>` +
  `<ellipse cx='203' cy='170' rx='150' ry='112' fill='#2a2013' opacity='0.35'/>` +
  `<ellipse cx='200' cy='160' rx='146' ry='108' fill='#f4efe3'/>` +
  `<ellipse cx='200' cy='157' rx='126' ry='90' fill='#eae1cd'/>` +
  `<ellipse cx='200' cy='154' rx='104' ry='72' fill='url(#f)'/>` +
  `<g fill='#f4e3c2' stroke='#dcae6b' stroke-width='2'>` +
  `<rect x='138' y='128' width='52' height='26' rx='12' transform='rotate(-12 164 141)'/>` +
  `<rect x='176' y='140' width='52' height='26' rx='12' transform='rotate(-4 202 153)'/>` +
  `<rect x='214' y='152' width='52' height='26' rx='12' transform='rotate(6 240 165)'/></g>` +
  `<ellipse cx='262' cy='126' rx='16' ry='10' fill='#9db661'/>` +
  `<circle cx='258' cy='124' r='2.5' fill='#c7d69a'/><circle cx='268' cy='129' r='2.5' fill='#c7d69a'/>` +
  `<ellipse cx='164' cy='127' rx='40' ry='15' fill='#fff' opacity='0.2'/></svg>`,
);

/** The same rest state over a LIGHT, pale plate — the white gauge, arrows and
 *  dark hint pill are overlay chrome that has to stay legible on whatever the
 *  camera hands back, so the two cells bracket the photography. */
export function LightPhotoAtRest() {
  return (
    <div style={{ maxWidth: 340 }}>
      <FlickRating photoUrl={CHICKEN} dishName="Poached Chicken" dishNameZh="白切雞" onRate={() => {}} />
    </div>
  );
}
