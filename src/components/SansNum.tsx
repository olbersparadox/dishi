// Sans numerals inside serif CJK.
//
// A sans digit reads visibly SMALLER than serif Han at the same font-size, so a
// number set in the body sans next to 已選…道 or 個四 looks like a subscript
// unless it is sized up and nudged onto the same optical line. That correction is
// the whole content of this component, and it is em-based so one wrapper serves a
// 15px bar and a 28px dice call alike.
//
// Extracted from LiarsDice's own CallText, which solved this first: the cart bar
// needed the identical treatment, and a second copy of the same regex-plus-class
// is exactly the lookalike CLAUDE.md's "reuse, don't imitate" rule is about.
// Wraps EVERY digit run, not just a leading one — 已選 2 道 carries its number in
// the middle, where CallText's anchored match found nothing.

/** Wrap the digit runs in `children` so they optically match the serif around them. */
export default function SansNum({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\d+)/).map((part, i) => (
        /^\d+$/.test(part) ? <span key={i} className="sans-num">{part}</span> : part
      ))}
    </>
  );
}
