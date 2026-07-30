import { Chop } from 'dishi';

// Colors are the caller's job — chopColorMap over a known member set, or
// chopColorFor for a lone id. Never derived from the display name inside Chop:
// name-seeded color meant renaming changed your color, and two names could
// collide into the same one. These are literal palette slots, as a caller passes.
const BLUE = '#3B82F6';
const VIOLET = '#A855F7';
const GREEN = '#22C55E';
const AMBER = '#F59E0B';
const CYAN = '#06B6D4';

/** A four-person table. Each member keeps a distinct slot — guaranteed for any
 *  table of six or fewer. */
export function TableMembers() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <Chop name="Jerry Chu" color={BLUE} />
      <Chop name="陳大文" color={VIOLET} />
      <Chop name="Wing" color={GREEN} />
      <Chop name="Priya Raman" color={AMBER} />
    </div>
  );
}

/** The two sizes actually in use: 26 inside ChopStampRow's row under a dish,
 *  36 (the default) standalone. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Chop name="陳大文" color={CYAN} size={26} />
      <Chop name="陳大文" color={CYAN} />
      <Chop name="陳大文" color={CYAN} size={48} />
    </div>
  );
}

/** The glyph rules: a Latin name of 2+ words gives both initials, a single Latin
 *  word gives one uppercased letter, and a CJK name gives its first character —
 *  no case to upper, and no first/last split to draw a second initial from. */
export function Glyphs() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <Chop name="Jerry Chu" color={BLUE} />
      <Chop name="Wing" color={GREEN} />
      <Chop name="陳大文" color={VIOLET} />
      <Chop name="さくら" color={AMBER} />
    </div>
  );
}
