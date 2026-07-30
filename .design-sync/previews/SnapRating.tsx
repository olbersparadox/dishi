import { SnapRating } from 'dishi';

// SnapRating is a FULL-SCREEN fixed overlay (glass over the page beneath), so
// each cell wraps it in a phone-sized frame whose transform makes the fixed
// overlay position against the frame instead of the whole capture viewport —
// the same footprint the surface really occupies on a phone. Only the REST
// state renders statically: the locked-slot verdict (the 130px native word),
// the skip fling, and the colour shifts are all mid-gesture states driven by
// internal spring state.
const FRAME: React.CSSProperties = {
  position: 'relative', width: 390, height: 660, margin: '0 auto',
  overflow: 'hidden', transform: 'translateZ(0)', outline: '1px solid var(--line)',
};

const svgUri = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
// Stand-in camera-roll photo (offline capture can't fetch a real JPEG): a
// bowl of 楊枝甘露 — warm, food-shaped content for the card being held.
const MANGO_SAGO = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>` +
  `<defs><radialGradient id='t' cx='0.3' cy='0.15' r='1.2'><stop offset='0' stop-color='#7a6248'/><stop offset='1' stop-color='#4a3826'/></radialGradient>` +
  `<radialGradient id='f' cx='0.45' cy='0.4' r='0.8'><stop offset='0' stop-color='#f6c04f'/><stop offset='0.6' stop-color='#ef9d33'/><stop offset='1' stop-color='#d17f22'/></radialGradient></defs>` +
  `<rect width='400' height='300' fill='url(#t)'/>` +
  `<ellipse cx='203' cy='170' rx='148' ry='112' fill='#241a10' opacity='0.4'/>` +
  `<ellipse cx='200' cy='160' rx='144' ry='108' fill='#f4efe3'/>` +
  `<ellipse cx='200' cy='157' rx='122' ry='88' fill='#e9e1cd'/>` +
  `<ellipse cx='200' cy='154' rx='102' ry='72' fill='url(#f)'/>` +
  `<rect x='150' y='128' width='26' height='22' rx='6' fill='#f5b83e' transform='rotate(-10 163 139)'/>` +
  `<rect x='214' y='120' width='24' height='20' rx='6' fill='#f7c14c' transform='rotate(12 226 130)'/>` +
  `<rect x='236' y='158' width='26' height='22' rx='6' fill='#f2ad33' transform='rotate(-6 249 169)'/>` +
  `<rect x='168' y='168' width='24' height='20' rx='6' fill='#f6bc45' transform='rotate(16 180 178)'/>` +
  `<circle cx='150' cy='158' r='4.5' fill='#fbe9c8'/><circle cx='196' cy='142' r='4' fill='#fdeed2'/>` +
  `<circle cx='214' cy='178' r='4.5' fill='#fbe9c8'/><circle cx='244' cy='134' r='4' fill='#fdeed2'/>` +
  `<circle cx='178' cy='150' r='3.5' fill='#fbe9c8'/><circle cx='228' cy='152' r='3.5' fill='#fdeed2'/>` +
  `<path d='M158 136 l14 -6' stroke='#f8d98a' stroke-width='4' stroke-linecap='round'/>` +
  `<path d='M232 190 l16 -4' stroke='#f8d98a' stroke-width='4' stroke-linecap='round'/>` +
  `<path d='M262 128 q8 -12 18 -8 q-4 12 -18 8' fill='#5d8a45'/>` +
  `<ellipse cx='166' cy='128' rx='38' ry='14' fill='#fff' opacity='0.16'/></svg>`,
);

/** First card of an album batch: the onboarding touch-dot bobbing over the
 *  photo, the drag caption below, the six-slot rail (vermillion dots — the one
 *  owner-approved exception to the seal-only reservation) on the right, and
 *  the close ✕ up top. */
export function AlbumFirstCard() {
  return (
    <div style={FRAME}>
      <SnapRating photoUrl={MANGO_SAGO} showHint onRate={() => {}} onSkip={() => {}} onClose={() => {}} />
    </div>
  );
}

/** A queued menu pick with no photo ever taken: the dish's NAME is the card
 *  you hold (中文 first, per the display language). No touch-dot — the
 *  onboarding hint is first-card-only; the persistent caption still shows. */
export function PickWithoutPhoto() {
  return (
    <div style={FRAME}>
      <SnapRating photoUrl={null} dishName="Poached Chicken" dishNameZh="白切雞"
        onRate={() => {}} onSkip={() => {}} onClose={() => {}} />
    </div>
  );
}
