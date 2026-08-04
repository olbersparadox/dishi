'use client';
// Untracked dev harness (same role as dev-picker / dev-onboard / dev-naming):
// mounts the REAL TasteFormLive and drives the creature renderer by hand —
// domain evidence does not exist in production yet (ship path step 2), so this
// page IS where the being can be seen at all. Left column: the production blob
// (no domains — the exact pixels every user sees today). Right: the same
// profile with domain evidence, i.e. the creature. They must read as one being
// at two stages of growth, not two species.
//
// Scenarios set PALATE + DOMAINS together (a 蟹宴 eater's method dims and
// domain record arrive as one life, not as independent sliders); the sliders
// then allow fine-tuning from that starting point. Not part of the app.
import { useState } from 'react';
import { TasteFormLive } from '@/components/TasteForm';
import type { DomainEvidence } from '@/lib/creatureForm';
import type { FormInputs } from '@/lib/blobForm';

type Scenario = {
  id: string; zh: string; en: string;
  vector: Record<string, number>;
  domains: DomainEvidence;
};

// Realistic profiles, not zero-fixtures — fixtures hide density failures.
// Evidence is derived below: any dim the vector speaks about is "known".
const SCENARIOS: Scenario[] = [
  {
    id: 'sea', zh: '海遊', en: 'sea-fed · steamed',
    vector: {
      umami: 0.8, fresh: 0.7, steamed: 0.75, raw: 0.5, tender: 0.5,
      salty: 0.3, sweet: -0.2, fried: -0.5, rich: -0.3, crispy: -0.1,
    },
    domains: { sea: 34, shell: 4, algae: 8 },
  },
  {
    id: 'crab', zh: '蟹宴', en: 'crustacean depth',
    vector: {
      umami: 0.85, fresh: 0.55, steamed: 0.7, rich: 0.35, tender: 0.4,
      sweet: 0.2, fried: -0.3, spicy: -0.2,
    },
    domains: { sea: 12, shell: 26, sub: { shell: { lobster: 4, crab: 18, prawn: 4 } } },
  },
  {
    id: 'lobster', zh: '龍蝦', en: 'lobster-heavy',
    vector: {
      umami: 0.8, rich: 0.5, grilled: 0.45, steamed: 0.4, creamy: 0.3,
      tender: 0.5, sweet: 0.15, bitter: -0.3,
    },
    domains: { sea: 10, shell: 24, sub: { shell: { lobster: 17, crab: 4, prawn: 3 } } },
  },
  {
    id: 'land', zh: '陸行', en: 'meat-fed · braised',
    vector: {
      rich: 0.7, umami: 0.6, braised: 0.7, grilled: 0.5, tender: 0.65,
      chewy: 0.3, salty: 0.4, fresh: -0.2, raw: -0.5, sour: -0.2,
    },
    domains: { land: 36, air: 6, sub: { land: { beef: 20, pork: 10, chicken: 6 } } },
  },
  {
    id: 'fire', zh: '炸辣', en: 'fried + spicy',
    vector: {
      spicy: 0.85, crispy: 0.8, fried: 0.8, grilled: 0.5, salty: 0.5,
      rich: 0.4, sweet: -0.4, steamed: -0.4, fresh: -0.3,
    },
    domains: { land: 22, air: 14, sub: { land: { beef: 6, pork: 8, chicken: 8 } } },
  },
  {
    id: 'garden', zh: '田園', en: 'field + fungus',
    vector: {
      fresh: 0.75, umami: 0.5, steamed: 0.55, tender: 0.4, sweet: 0.2,
      bitter: 0.15, fried: -0.4, rich: -0.4, chewy: -0.1,
    },
    domains: { field: 26, fungus: 12, algae: 5 },
  },
  {
    id: 'air', zh: '輕羽', en: 'poultry & light',
    vector: {
      tender: 0.6, umami: 0.55, grilled: 0.5, fresh: 0.45, baked: 0.35,
      salty: 0.3, braised: 0.2, rich: -0.2, creamy: -0.2,
    },
    domains: { air: 30, land: 8 },
  },
  {
    id: 'bake', zh: '焗甜', en: 'baked & sweet',
    // a dessert life is near-silent in 骨 (榖 is SKIN in this framework, not
    // anatomy) and loud in 膚/姿 — a risen dome with almost no appendages.
    // Domains stay tiny so nothing passes the anatomy gates.
    vector: {
      sweet: 0.8, creamy: 0.7, baked: 0.75, crispy: 0.35, rich: 0.45,
      spicy: -0.7, bitter: -0.4, sour: -0.2,
    },
    domains: { field: 3, land: 3 },
  },
];

const DOMAIN_SLIDERS = ['sea', 'land', 'air', 'shell', 'field', 'algae', 'fungus'] as const;

function inputsFor(sc: Scenario): FormInputs {
  // Evidence mirrors the vector: spoken dims are known (≥3), silent dims fog —
  // the same relationship a real profile at this maturity would carry.
  const evidence: Record<string, number> = {};
  for (const [d, v] of Object.entries(sc.vector)) {
    if (v !== 0) evidence[d] = Math.abs(v) > 0.4 ? 9 : 4;
  }
  return { vector: sc.vector, evidence, ratingCount: 40, seed: `dev-creature:${sc.id}:v1` };
}

export default function DevCreature() {
  const [scId, setScId] = useState('crab');
  const sc = SCENARIOS.find(s => s.id === scId)!;
  const [domains, setDomains] = useState<DomainEvidence>(sc.domains);
  const [size, setSize] = useState(190);
  const inputs = inputsFor(sc);

  const pick = (s: Scenario) => { setScId(s.id); setDomains(s.domains); };
  const setDom = (k: (typeof DOMAIN_SLIDERS)[number], v: number) =>
    setDomains(d => ({ ...d, [k]: v }));

  return (
    <div className="page" style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 2 }}>墨靈 · the creature on the real render path</h3>
      <p className="card-meta" style={{ marginBottom: 12 }}>
        Left: production blob (no domains — today&apos;s exact pixels). Right: the
        SAME profile with lived domain evidence. One being, two stages of growth.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {SCENARIOS.map(s => (
          <button key={s.id} type="button" className={`chip ${scId === s.id ? 'on' : ''}`}
            onClick={() => pick(s)} title={s.en}>{s.zh}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ textAlign: 'center' }}>
          <TasteFormLive inputs={inputs} size={size} glyph="鮮" />
          <div className="card-meta" style={{ marginTop: 6 }}>blob (production)</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <TasteFormLive inputs={inputs} size={size} glyph="鮮" domains={domains} />
          <div className="card-meta" style={{ marginTop: 6 }}>{sc.zh} creature</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {/* The size a feed row or version card actually shows. A gesture that
              only reads at 190px is decoration, not anatomy. */}
          <TasteFormLive inputs={inputs} size={72} domains={domains} />
          <div className="card-meta" style={{ marginTop: 6 }}>72px</div>
        </div>
      </div>

      {/* The size ladder. Anatomy that only reads at 280px is decoration, and a
          single slider can't show WHERE it stops reading — the whole curve has
          to be visible at once. This is where the coat fusing into a solid rim
          below ~184px was caught. */}
      <div style={{ marginTop: 22 }}>
        <div className="card-meta" style={{ marginBottom: 4 }}>size ladder — where does the anatomy stop reading?</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {[280, 220, 184, 150, 120, 96, 72].map(px => (
            <div key={px} style={{ textAlign: 'center' }}>
              <TasteFormLive inputs={inputs} size={px} domains={domains} />
              <div className="card-meta">{px}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6, maxWidth: 400, marginTop: 20 }}>
        {DOMAIN_SLIDERS.map(k => (
          <label key={k} className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 64 }}>{k} {domains[k] ?? 0}</span>
            <input type="range" min={0} max={40} step={1} value={domains[k] ?? 0}
              onChange={e => setDom(k, Number(e.target.value))} style={{ flex: 1 }} />
          </label>
        ))}
        <label className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 64 }}>size {size}</span>
          <input type="range" min={64} max={280} step={2} value={size}
            onChange={e => setSize(Number(e.target.value))} style={{ flex: 1 }} />
        </label>
      </div>
    </div>
  );
}
