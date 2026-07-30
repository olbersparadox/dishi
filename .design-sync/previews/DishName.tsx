import { DishName, SealStamp } from 'dishi';

// The bilingual name block: primary slot on top, secondary beneath. Each slot
// gets its own script class, because the 0.05em base tracking that suits
// Han/Kana/Hangul runs Latin text visibly loose — so these cells are also the
// place typography regressions show up first.

/** The canonical two-slot render. A name with any CJK character counts as CJK
 *  for tracking, which is why "300g 牛胸腹" sits with the Han names. */
export function Bilingual() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DishName name="Beef Chow Fun" name_zh="乾炒牛河" />
      <DishName name="Poached Chicken" name_zh="白切雞" />
      <DishName name="Mango Pomelo Sago" name_zh="楊枝甘露" />
    </div>
  );
}

/** Latin-primary alongside CJK-primary, so the two tracking treatments sit
 *  side by side. */
export function ScriptTracking() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DishName name="Pineapple Bun with Butter" name_zh="菠蘿油" />
      <DishName name="300g Beef Brisket" name_zh="300g 牛胸腹" />
    </div>
  );
}

/** Two sizes: lg for a dish's own header, md (the default) for rows and lists. */
export function Sizes() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DishName name="Beef Chow Fun" name_zh="乾炒牛河" size="lg" />
      <DishName name="Beef Chow Fun" name_zh="乾炒牛河" />
    </div>
  );
}

/** Scan results number their rows through `prefix`, so the rank shares the
 *  primary slot's size and weight instead of being a separate column. */
export function WithRank() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DishName prefix="1. " name="Beef Chow Fun" name_zh="乾炒牛河" />
      <DishName prefix="2. " name="Poached Chicken" name_zh="白切雞" />
      <DishName prefix="3. " name="Salt and Pepper Squid" name_zh="椒鹽鮮魷" />
    </div>
  );
}

/** `suffix` renders inline right after the core name — the 印 seal sits on the
 *  same line as the dish rather than floating beside the whole bilingual block. */
export function WithSeal() {
  return <DishName size="lg" name="Beef Chow Fun" name_zh="乾炒牛河" suffix={<SealStamp />} />;
}
