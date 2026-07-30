import { PublicDish } from 'dishi';

// The shared-dish permalink someone lands on from a messenger link — one
// FeedCard (the SAME card the feed and dossier mount) leading, the palate
// link and acquisition CTA following underneath it. No real dish photo asset
// ships in this repo for a static preview, so the photo slot below is a
// plain generated tile in a food-safe warm tone (never the seal's vermillion)
// standing in for a real photograph — DuelSide (which FeedCard mounts) has no
// other way to hold its 4:3 frame with a null photo_url than the flat
// placeholder fill, and an empty tile would under-sell what this page is
// actually for.
function photoTile(emoji: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">`
    + `<rect width="400" height="300" fill="${bg}"/>`
    + `<text x="50%" y="54%" font-size="110" text-anchor="middle" dominant-baseline="middle">${emoji}</text>`
    + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A visitor arriving from a messenger link, not signed in — the acquisition
 *  line shows under the dossier link, and there's no back button (the doorway
 *  onward is the author line inside the card, or the CTA). Wrapped at the
 *  app's own .shell width (420px) — this page never renders any wider, and
 *  the photo's 4:3 frame needs the real column width to read at its real
 *  proportion rather than stretching edge-to-edge of a bare canvas. */
export function Visitor() {
  return (
    <div style={{ maxWidth: 420 }}>
      <PublicDish
        anchor={{
          id: 'dish-1',
          name: 'Beef Chow Fun', name_zh: '乾炒牛河',
          restaurant: '太興 (銅鑼灣店)',
          photo_url: photoTile('\u{1F35C}', '#8a6a3f'),
          diet: ['beef'], heaviness: 'medium', ingredients: ['noodle', 'bean sprout'],
          verdict: 'flick.loved', reason: '鑊氣十足，河粉夠爽口，唔會太油。',
        }}
        username="jerrychu"
        isOwner={false}
      />
    </div>
  );
}

/** The dish's own owner viewing their own share: no acquisition line (they
 *  already have the app), everything else identical. */
export function Owner() {
  return (
    <div style={{ maxWidth: 420 }}>
      <PublicDish
        anchor={{
          id: 'dish-2',
          name: 'Mango Pomelo Sago', name_zh: '楊枝甘露',
          restaurant: '許留山',
          photo_url: photoTile('\u{1F96D}', '#c98a3e'),
          diet: [], heaviness: 'light', ingredients: ['mango', 'pomelo'],
          verdict: 'flick.inhaled', reason: '芒果好新鮮，柚子粒夠多，唔會太甜。',
        }}
        username="jerrychu"
        isOwner
      />
    </div>
  );
}
