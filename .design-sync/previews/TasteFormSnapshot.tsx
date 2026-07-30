import { TasteFormSnapshot } from 'dishi';

// The static SVG twin of the live blob — version cards, export headers, share
// images. Same FormInputs contract as the live render (blobForm.ts): vector
// -1..1, evidence = how many ratings taught each dim (>= 3 shapes the form at
// full strength, 1-2 emerges faintly, 0 contributes nothing but fog), seed =
// `${user}:v${profileVersion}` so the same profile always draws the same being.

// One person, three profile versions — the SAME palate getting better known.
// V1: eight ratings, most dims still fog (big pale wash, small timid form).
const V1 = {
  vector: {
    umami: 0.30, crispy: 0.28, fried: 0.12, salty: 0.10, sweet: -0.08,
  } as Record<string, number>,
  evidence: { umami: 3, crispy: 3, salty: 2, fried: 2, sweet: 1 } as Record<string, number>,
  ratingCount: 8,
  seed: 'kayan:v1',
};

// V2: two dozen ratings — lobes firming up, fog receding.
const V2 = {
  vector: {
    umami: 0.52, crispy: 0.44, fried: 0.30, rich: 0.24, salty: 0.18, tender: 0.16,
    braised: 0.14, spicy: 0.10, sweet: -0.16, bitter: -0.28,
  } as Record<string, number>,
  evidence: {
    umami: 8, crispy: 6, salty: 6, fried: 5, sweet: 4, rich: 3, tender: 3,
    bitter: 2, spicy: 2, braised: 2, chewy: 1, steamed: 1,
  } as Record<string, number>,
  ratingCount: 24,
  seed: 'kayan:v2',
};

// V3: the current profile — strong 鮮味/脆/炸 lobes, the 苦 dislike carving in.
const V3 = {
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

/** Export-header size, with the glyph of the top loved KNOWN dims (first char of
 *  each dim's zh label — topGlyphDims never draws from fog or learning dims). */
export function ExportHeader() {
  return <TasteFormSnapshot inputs={V3} size={200} glyph="鮮 脆 炸" />;
}

/** A version-history row: the same palate at V1, V2, V3. Growth shows twice —
 *  the base radius scales with rating count, and the pale fog wash shrinks as
 *  dims move fog to learning to known. */
export function VersionGrowth() {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
      {([['V1', V1], ['V2', V2], ['V3', V3]] as const).map(([label, inputs]) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <TasteFormSnapshot inputs={inputs} size={120} />
          <span className="card-meta">{label}</span>
        </div>
      ))}
    </div>
  );
}
