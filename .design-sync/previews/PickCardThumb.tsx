import { PickCardThumb, DishName, RateIcon, TrashIcon } from 'dishi';

// PickCardThumb never sits alone — it's the left thumb of a 待評 pick-card
// row (profile/page.tsx's `.pick-card`): name + restaurant to its right,
// rate/delete actions at the far end. Reproduced here so the card teaches the
// real row shape, not a bare tile.
function photoTile(emoji: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">`
    + `<rect width="120" height="120" fill="${bg}"/>`
    + `<text x="50%" y="54%" font-size="56" text-anchor="middle" dominant-baseline="middle">${emoji}</text>`
    + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function PickRow({ children, name, name_zh, meta }: {
  children: React.ReactNode; name: string; name_zh: string; meta: string;
}) {
  return (
    <div className="pick-card" style={{ maxWidth: 380 }}>
      {children}
      <div className="pick-card-info">
        <div className="pick-card-name">
          <DishName name={name} name_zh={name_zh} />
        </div>
        <div className="pick-card-meta">{meta}</div>
      </div>
      <div className="pick-card-actions">
        <button className="icon-btn lg rate" aria-label="Rate"><RateIcon size={20} /></button>
        <button className="icon-btn lg delete" aria-label="Delete"><TrashIcon size={20} /></button>
      </div>
    </div>
  );
}

/** No photo yet — the passive paper-inset fill with the camera badge pinned
 *  to the corner, the tap target for adding one. */
export function Empty() {
  return (
    <PickRow name="Beef Chow Fun" name_zh="乾炒牛河" meta="太興 (銅鑼灣店)">
      <PickCardThumb photoUrl={null} uploading={false} onPick={() => {}} />
    </PickRow>
  );
}

/** A photo already attached — badge disappears, the tile shows the shot
 *  itself. */
export function WithPhoto() {
  return (
    <PickRow name="Poached Chicken" name_zh="白切雞" meta="太平館">
      <PickCardThumb photoUrl={photoTile('\u{1F414}', '#b8874a')} uploading={false} onPick={() => {}} />
    </PickRow>
  );
}

/** Mid-upload: the camera badge swaps its glyph for the busy ellipsis. */
export function Uploading() {
  return (
    <PickRow name="Steamed Egg with Minced Pork" name_zh="肉碎蒸蛋" meta="住家菜">
      <PickCardThumb photoUrl={null} uploading onPick={() => {}} />
    </PickRow>
  );
}
