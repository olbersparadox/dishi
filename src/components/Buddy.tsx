'use client';
import type { Species } from '@/lib/buddy';

/**
 * The Taste Buddy renderer. Layered SVG, deliberately (see honesty note in the PR):
 * loads instantly, animates cheaply (CSS), and every visual layer is driven by real
 * profile data passed in as props. Structure is ready for a three.js swap later —
 * the data contract (species, sizeStage, elements) wouldn't change.
 *
 * Growth is expressed three ways:
 *  - scale: the buddy literally grows with level (sizeStage 0-5)
 *  - expression: closed dot eyes -> open eyes -> sparkle eyes + smile
 *  - elements: cuisine accessory + up to two attribute auras, each earned by a
 *    specific number in the taste vector
 */

type ElementId = string;

export default function Buddy({
  species,
  sizeStage,
  elements,
  size = 180,
}: {
  species: Species;
  sizeStage: number; // 0-5
  elements: { kind: string; id: ElementId }[];
  size?: number;
}) {
  const scale = 0.55 + sizeStage * 0.09; // hatchling small -> legend big
  const eyes = sizeStage >= 4 ? 'sparkle' : sizeStage >= 2 ? 'open' : 'dot';
  const has = (id: string) => elements.some(e => e.id === id);
  const cuisine = elements.find(e => e.kind === 'cuisine')?.id;

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className="buddy" role="img"
      aria-label={`Your taste buddy, a ${species}`}>
      <defs>
        <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e9b44c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#e9b44c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* --- auras (behind the body) --- */}
      {has('golden') && <circle cx="100" cy="105" r="78" fill="url(#goldGlow)" className="buddy-breathe" />}
      {has('fire') && (
        <g className="buddy-flicker">
          <path d="M100 18 C92 34 84 40 88 52 C91 60 109 60 112 52 C116 40 108 34 100 18Z" fill="#c93a2b" opacity="0.85" />
          <path d="M100 30 C96 38 92 42 95 49 C97 54 103 54 105 49 C108 42 104 38 100 30Z" fill="#e9b44c" />
        </g>
      )}
      {has('fresh') && (
        <g className="buddy-sway" opacity="0.9">
          <ellipse cx="38" cy="70" rx="12" ry="5" fill="#33705f" transform="rotate(-30 38 70)" />
          <ellipse cx="162" cy="70" rx="12" ry="5" fill="#33705f" transform="rotate(30 162 70)" />
          <ellipse cx="100" cy="34" rx="12" ry="5" fill="#33705f" transform="rotate(0 100 34)" />
        </g>
      )}
      {has('sweet') && (
        <g className="buddy-twinkle" fill="#e78fb3">
          <circle cx="42" cy="52" r="4" /><circle cx="160" cy="46" r="3" /><circle cx="172" cy="98" r="4" />
        </g>
      )}
      {has('crackle') && (
        <g className="buddy-twinkle" fill="#e9b44c">
          <path d="M36 100 l4 -10 4 10 10 4 -10 4 -4 10 -4 -10 -10 -4Z" />
          <path d="M158 130 l3 -8 3 8 8 3 -8 3 -3 8 -3 -8 -8 -3Z" />
        </g>
      )}

      {/* --- the animal --- */}
      <g className="buddy-bob" transform={`translate(100 118) scale(${scale}) translate(-100 -118)`}>
        <Body species={species} />
        <Eyes species={species} kind={eyes} />
        {sizeStage >= 3 && <Smile species={species} />}

        {/* --- cuisine accessories (on the body so they scale with it) --- */}
        {cuisine === 'japanese' && (
          <g>{/* hachimaki */}
            <rect x="58" y="66" width="84" height="12" rx="6" fill="#f4f1ea" stroke="#c93a2b" strokeWidth="2" />
            <circle cx="100" cy="72" r="5" fill="#c93a2b" />
            <path d="M142 70 l16 -8 -4 12 Z" fill="#f4f1ea" stroke="#c93a2b" strokeWidth="1.5" />
          </g>
        )}
        {(cuisine === 'cantonese' || cuisine === 'chinese') && (
          <g>{/* bamboo steamer hat */}
            <ellipse cx="100" cy="62" rx="34" ry="9" fill="#d8b98a" stroke="#a5854f" strokeWidth="2" />
            <path d="M70 62 a30 16 0 0 1 60 0" fill="#e8d0a5" stroke="#a5854f" strokeWidth="2" />
            <ellipse cx="100" cy="50" rx="10" ry="4" fill="#f4f1ea" opacity="0.85" className="buddy-steam" />
          </g>
        )}
        {(cuisine === 'thai' || cuisine === 'sichuan' || cuisine === 'korean') && (
          <g>{/* chili garland/charm */}
            <path d="M78 128 q22 14 44 0" fill="none" stroke="#33705f" strokeWidth="2.5" />
            {[82, 100, 118].map(x => (
              <path key={x} d={`M${x} ${x === 100 ? 138 : 132} q-3 10 2 14 q6 -2 4 -14`} fill="#c93a2b" />
            ))}
          </g>
        )}
        {(cuisine === 'italian' || cuisine === 'french') && (
          <g>{/* toque / beret */}
            {cuisine === 'italian'
              ? <><rect x="76" y="52" width="48" height="14" rx="4" fill="#fff" stroke="#d5ddd2" strokeWidth="2" />
                  <path d="M76 56 a24 18 0 0 1 48 0 Z" fill="#fff" stroke="#d5ddd2" strokeWidth="2" /></>
              : <><ellipse cx="100" cy="60" rx="30" ry="10" fill="#2b3a55" />
                  <circle cx="100" cy="50" r="4" fill="#2b3a55" /></>}
          </g>
        )}
        {(cuisine === 'indian' || cuisine === 'mexican' || cuisine === 'vietnamese') && (
          <g>{/* generic charm: herb sprig / spice */}
            <circle cx="140" cy="132" r="9" fill="#e9b44c" stroke="#a5854f" strokeWidth="2" />
            <path d="M140 126 q4 -8 10 -9" stroke="#33705f" strokeWidth="2.5" fill="none" />
          </g>
        )}
        {has('royal') && (
          <g>{/* velvet crown */}
            <path d="M78 58 l8 -14 12 10 2 -16 2 16 12 -10 8 14 Z" fill="#e9b44c" stroke="#a5854f" strokeWidth="2" />
          </g>
        )}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- species ----
function Body({ species }: { species: Species }) {
  switch (species) {
    case 'shiba':
      return (
        <g>
          <path d="M62 84 L74 58 L90 76 Z" fill="#d98e4a" /><path d="M138 84 L126 58 L110 76 Z" fill="#d98e4a" />
          <path d="M66 82 L74 66 L84 78 Z" fill="#f4e3cf" /><path d="M134 82 L126 66 L116 78 Z" fill="#f4e3cf" />
          <ellipse cx="100" cy="118" rx="46" ry="44" fill="#d98e4a" />
          <ellipse cx="100" cy="128" rx="30" ry="26" fill="#f4e3cf" />
          <ellipse cx="100" cy="116" rx="6" ry="4.5" fill="#3a2c22" />
        </g>
      );
    case 'redpanda':
      return (
        <g>
          <circle cx="70" cy="74" r="16" fill="#b5502a" /><circle cx="130" cy="74" r="16" fill="#b5502a" />
          <circle cx="70" cy="74" r="8" fill="#f4e3cf" /><circle cx="130" cy="74" r="8" fill="#f4e3cf" />
          <ellipse cx="100" cy="118" rx="46" ry="44" fill="#c96a3b" />
          <ellipse cx="80" cy="112" rx="14" ry="16" fill="#f4e3cf" /><ellipse cx="120" cy="112" rx="14" ry="16" fill="#f4e3cf" />
          <ellipse cx="100" cy="130" rx="22" ry="18" fill="#f4e3cf" />
          <ellipse cx="100" cy="120" rx="6" ry="4.5" fill="#3a2c22" />
        </g>
      );
    case 'octo':
      return (
        <g>
          <ellipse cx="100" cy="108" rx="44" ry="42" fill="#b06ab3" />
          {[64, 80, 96, 112, 128].map((x, i) => (
            <path key={x} d={`M${x + 4} 142 q${i % 2 ? 8 : -8} 16 0 22`} stroke="#b06ab3" strokeWidth="11" fill="none" strokeLinecap="round" />
          ))}
          <circle cx="84" cy="126" r="5" fill="#8d4f91" /><circle cx="116" cy="126" r="5" fill="#8d4f91" />
        </g>
      );
    case 'frog':
      return (
        <g>
          <circle cx="76" cy="78" r="15" fill="#5d9e5f" /><circle cx="124" cy="78" r="15" fill="#5d9e5f" />
          <ellipse cx="100" cy="120" rx="46" ry="40" fill="#5d9e5f" />
          <ellipse cx="100" cy="134" rx="30" ry="20" fill="#dbeecb" />
        </g>
      );
    case 'penguin':
      return (
        <g>
          <ellipse cx="100" cy="112" rx="42" ry="46" fill="#28323c" />
          <ellipse cx="100" cy="122" rx="28" ry="32" fill="#f4f1ea" />
          <path d="M94 104 l6 8 6 -8 Z" fill="#e9b44c" />
          <path d="M58 116 q-10 12 -2 24" stroke="#28323c" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M142 116 q10 12 2 24" stroke="#28323c" strokeWidth="10" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

function Eyes({ species, kind }: { species: Species; kind: 'dot' | 'open' | 'sparkle' }) {
  // Frog and red panda eyes sit on their protrusions; others on the face.
  const [lx, rx, y] = species === 'frog' ? [76, 124, 78] : species === 'redpanda' ? [80, 120, 108] : [84, 116, 104];
  if (kind === 'dot') return (
    <g fill="#22201d"><circle cx={lx} cy={y} r="3" /><circle cx={rx} cy={y} r="3" /></g>
  );
  if (kind === 'open') return (
    <g>
      <circle cx={lx} cy={y} r="6.5" fill="#22201d" /><circle cx={rx} cy={y} r="6.5" fill="#22201d" />
      <circle cx={lx + 2} cy={y - 2} r="2" fill="#fff" /><circle cx={rx + 2} cy={y - 2} r="2" fill="#fff" />
    </g>
  );
  return (
    <g>
      <circle cx={lx} cy={y} r="7" fill="#22201d" /><circle cx={rx} cy={y} r="7" fill="#22201d" />
      <circle cx={lx + 2.5} cy={y - 2.5} r="2.5" fill="#fff" /><circle cx={rx + 2.5} cy={y - 2.5} r="2.5" fill="#fff" />
      <circle cx={lx - 2.5} cy={y + 2} r="1.3" fill="#fff" /><circle cx={rx - 2.5} cy={y + 2} r="1.3" fill="#fff" />
    </g>
  );
}

function Smile({ species }: { species: Species }) {
  const y = species === 'octo' ? 136 : species === 'penguin' ? 114 : 126;
  return <path d={`M92 ${y} q8 7 16 0`} stroke="#22201d" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
}
