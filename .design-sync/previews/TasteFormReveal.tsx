import { TasteFormReveal } from 'dishi';

// Blob-or-radar toggle: the blob is the identity, one tap swaps it for the 18-dim
// radar at 1.55x, tap again swaps back. Statically it shows the blob state; the
// radar state is what the TasteRadar cards show. Both real mounts wrap it in
// .taste-form-card > .taste-blob-anchor (TasteFormCard on the Taste tab,
// PublicDossier on a shared profile page), reproduced here so the card teaches
// the blob on its actual paper, not floating bare.

const ZH: Record<string, string> = {
  sweet: '甜', salty: '鹹', sour: '酸', bitter: '苦', umami: '鮮味', spicy: '辣',
  crispy: '脆', creamy: '香滑', chewy: '煙韌', tender: '嫩滑', rich: '濃郁', fresh: '新鮮',
  fried: '炸', grilled: '燒烤', braised: '炆', steamed: '蒸', raw: '生食', baked: '焗',
};

const VECTOR: Record<string, number> = {
  umami: 0.72, crispy: 0.58, fried: 0.46, rich: 0.40, braised: 0.34, tender: 0.30,
  salty: 0.24, spicy: 0.18, steamed: 0.14, chewy: 0.12, grilled: 0.10, fresh: 0.08,
  creamy: 0.05, sour: -0.10, sweet: -0.22, raw: -0.28, bitter: -0.45,
};
const EVIDENCE: Record<string, number> = {
  umami: 14, salty: 12, crispy: 11, fried: 9, rich: 8, sweet: 7, tender: 6,
  spicy: 5, bitter: 4, braised: 4, chewy: 3, steamed: 3, fresh: 2, creamy: 2,
  grilled: 2, sour: 1, raw: 1,
};

/** The Taste tab mount: owner's own card, glyph over the blob, seeded by
 *  `${userId}:v${profileVersion}`. Tap target for the radar reveal. */
export function TasteTabCard() {
  return (
    <div className="taste-form-card" style={{ maxWidth: 340 }}>
      <div className="taste-blob-anchor">
        <TasteFormReveal
          inputs={{ vector: VECTOR, evidence: EVIDENCE, ratingCount: 47, seed: 'kayan:v3' }}
          size={190}
          glyph="鮮 脆 炸"
          vector={VECTOR}
          labelFor={(dim) => ZH[dim] ?? dim}
        />
      </div>
    </div>
  );
}

/** The public dossier mount: a visitor viewing dishi.kayan — same shell, same
 *  reveal, but no glyph (the dossier passes none) and a username-based seed. */
export function PublicDossierBlob() {
  return (
    <div className="taste-form-card" style={{ maxWidth: 340 }}>
      <div className="taste-blob-anchor">
        <TasteFormReveal
          inputs={{ vector: VECTOR, evidence: EVIDENCE, ratingCount: 47, seed: 'kayan:v3' }}
          size={190}
          vector={VECTOR}
          labelFor={(dim) => ZH[dim] ?? dim}
        />
      </div>
    </div>
  );
}
