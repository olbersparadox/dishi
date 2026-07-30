import { TasteFormLive } from 'dishi';

// The breathing Canvas render — identical base form to TasteFormSnapshot for the
// same inputs (the motion is layered noise, never a different being). Two real
// mounts in the app: 190px centered in a card (TasteFormCard's migration state),
// 150px as the TasteGrowth header blob.

// The same seasoned profile the snapshot and radar cells use, so the family of
// cards visibly describes ONE person.
const SEASONED = {
  vector: {
    umami: 0.72, crispy: 0.58, fried: 0.46, rich: 0.40, braised: 0.34, tender: 0.30,
    salty: 0.24, spicy: 0.18, steamed: 0.14, chewy: 0.12, grilled: 0.10, fresh: 0.08,
    creamy: 0.05, sour: -0.10, sweet: -0.22, raw: -0.28, bitter: -0.45,
  } as Record<string, number>,
  evidence: {
    umami: 14, salty: 12, crispy: 11, fried: 9, rich: 8, sweet: 7, tender: 6,
    spicy: 5, bitter: 4, braised: 4, chewy: 3, steamed: 3, fresh: 2, creamy: 2,
    grilled: 2, sour: 1, raw: 1,
  } as Record<string, number>,
  ratingCount: 47,
  seed: 'kayan:v3',
};

// Eight ratings in: smaller base radius, wide pale fog halo, no glyph yet
// (topGlyphDims needs KNOWN loved dims, and almost nothing is known).
const EARLY = {
  vector: { umami: 0.30, crispy: 0.28, fried: 0.12, salty: 0.10, sweet: -0.08 } as Record<string, number>,
  evidence: { umami: 3, crispy: 3, salty: 2, fried: 2, sweet: 1 } as Record<string, number>,
  ratingCount: 8,
  seed: 'kayan:v1',
};

/** As TasteFormCard mounts it: 190px, centered in a card body, glyph = first
 *  characters of the top loved known dims' zh labels (鮮味 脆 炸). */
export function TasteCard() {
  return (
    <div className="card" style={{ maxWidth: 340 }}>
      <div className="card-body" style={{ textAlign: 'center' }}>
        <TasteFormLive inputs={SEASONED} size={190} glyph="鮮 脆 炸" />
      </div>
    </div>
  );
}

/** The TasteGrowth header size: 150px, no card around it. */
export function GrowthHeader() {
  return <TasteFormLive inputs={SEASONED} size={150} glyph="鮮 脆 炸" />;
}

/** A young profile: the form is smaller (growth saturates with rating count),
 *  the fog wash is wide, and there is no glyph to show yet. */
export function EarlyForm() {
  return <TasteFormLive inputs={EARLY} size={190} />;
}
