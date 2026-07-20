import { describe, it, expect } from 'vitest';
import { carbSuspicion, HK_MENU_SHORTHAND_GUIDANCE, CARB_RECHECK_LINE, SCAN_PROMPTS, ENRICH_SYSTEM } from '../src/lib/menuScan';
import { VISION_PROMPTS } from '../src/lib/vision';

// HK menus name the carb by a single shorthand character (米=米粉, 河=河粉, 意=意粉,
// 通=通粉, 丁=出前一丁). Vision keeps misreading it as rice — 炆米 shipped as "炆飯", and
// 干炒牛河 shipped with a 飯 ingredient chip + the literal English "Dry Fried Beef
// River". A wrong carb then poisons the English name, ingredient chips, and the
// attribute vector the engine eats. These tests pin the mechanical tripwire that
// catches the ingredient-level pollution WITHOUT firing on the innocent look-alikes
// (粟米/corn, 蝦米/dried shrimp, 雞丁/diced chicken, 通菜/water spinach), which is the
// whole reason a string may never author the carb.

describe('carbSuspicion — the carb-shorthand tripwire', () => {
  // ── Rule 1: noodle shorthand in the name, rice in the ingredients ──────────
  it('FIRES on 炆米 read as rice (the 炆米→炆飯 production bug)', () => {
    // The enrich call sites pass name_original (炆米, kept verbatim per the "o never
    // changes" rule) as the name, even when the derived z was mistranslated to 炆飯.
    expect(carbSuspicion('炆米', '炆飯', ['rice', 'soy sauce'])).toBe(true);
  });
  it('FIRES on 干炒牛河 shipped with a 飯 ingredient chip (the牛河→beef river bug)', () => {
    expect(carbSuspicion('Dry Fried Beef River', '干炒牛河', ['飯', 'beef', 'scallion'])).toBe(true);
  });
  it('FIRES on 星洲炒米 read as rice', () => {
    expect(carbSuspicion('Singapore fried rice', '星洲炒米', ['rice', 'curry', 'shrimp'])).toBe(true);
  });
  it('FIRES on 肉醬意 (bolognese spaghetti) mis-derived to rice', () => {
    expect(carbSuspicion('Bolognese', '肉醬意', ['rice', 'minced beef', 'tomato'])).toBe(true);
  });
  it('FIRES on 火腿通 (ham macaroni) mis-derived to rice', () => {
    expect(carbSuspicion('Ham macaroni', '火腿通', ['ham', 'rice'])).toBe(true);
  });

  // ── The noodle words must WIN over the rice substring in "rice noodle" ─────
  it('does NOT fire on 星洲炒米粉 correctly derived (rice vermicelli is a NOODLE)', () => {
    expect(carbSuspicion('Singapore vermicelli', '星洲炒米粉', ['rice vermicelli', 'curry', 'shrimp'])).toBe(false);
  });
  it('does NOT fire on 干炒牛河 correctly derived to flat rice noodle', () => {
    expect(carbSuspicion('Beef chow fun', '干炒牛河', ['flat rice noodle', 'beef', 'bean sprout'])).toBe(false);
  });
  it('does NOT fire on 火腿通 correctly derived to macaroni', () => {
    expect(carbSuspicion('Ham macaroni', '火腿通', ['macaroni', 'ham', 'egg'])).toBe(false);
  });

  // ── Innocent look-alikes: the character is NOT carb shorthand (the traps) ──
  it('does NOT fire on 糯米雞 (glutinous rice, 米 is a rice grain here)', () => {
    expect(carbSuspicion('Glutinous rice chicken', '糯米雞', ['glutinous rice', 'chicken', 'mushroom'])).toBe(false);
  });
  it('does NOT fire on 粟米斑塊飯 (粟米 is corn, not vermicelli) — a genuine rice dish', () => {
    expect(carbSuspicion('Corn fish fillet rice', '粟米斑塊飯', ['corn', 'fish', 'rice'])).toBe(false);
  });
  it('does NOT fire on 蝦米蒸蛋 (蝦米 is dried shrimp)', () => {
    expect(carbSuspicion('Steamed egg with dried shrimp', '蝦米蒸蛋', ['dried shrimp', 'egg'])).toBe(false);
  });
  it('does NOT fire on 宮保雞丁 (雞丁 is diced chicken, not instant noodle)', () => {
    expect(carbSuspicion('Kung pao chicken', '宮保雞丁', ['chicken', 'peanut', 'chili', 'rice'])).toBe(false);
  });
  it('does NOT fire on 炒通菜 (通菜 is water spinach, not macaroni)', () => {
    expect(carbSuspicion('Stir-fried water spinach', '炒通菜', ['water spinach', 'garlic'])).toBe(false);
  });
  it('does NOT fire on 河蝦炒飯 (河蝦 is river shrimp) — a rice dish', () => {
    expect(carbSuspicion('River shrimp fried rice', '河蝦炒飯', ['river shrimp', 'rice', 'egg'])).toBe(false);
  });

  // ── 治/多 (bread shorthand) are the glossary's job, not this rice/noodle net ─
  it('does NOT fire on 蛋治 (egg sandwich) — bread shorthand, no carb collision', () => {
    expect(carbSuspicion('Egg sandwich', '蛋治', ['egg', 'bread'])).toBe(false);
  });
  it('does NOT fire on 西多 (French toast) — bread shorthand', () => {
    expect(carbSuspicion('French toast', '西多', ['bread', 'egg', 'butter'])).toBe(false);
  });

  // ── Reverse trip: a plainly-rice name whose ingredients came back noodle ───
  it('FIRES on 揚州炒飯 mis-derived to noodles', () => {
    expect(carbSuspicion('Yangzhou fried rice', '揚州炒飯', ['egg noodle', 'shrimp', 'char siu'])).toBe(true);
  });
  it('does NOT fire on 揚州炒飯 correctly derived to rice', () => {
    expect(carbSuspicion('Yangzhou fried rice', '揚州炒飯', ['rice', 'egg', 'shrimp', 'char siu'])).toBe(false);
  });

  // ── Backfill path: no persisted ingredients, English name carries the signal ─
  it('FIRES from the English name alone when the zh shorthand survived (backfill case)', () => {
    // Stored dish: zh kept as 炆米, English mis-derived to "Braised Rice", no ingredients.
    expect(carbSuspicion('Braised Rice', '炆米', [])).toBe(true);
  });
  it('does NOT fire from the name alone when the English is the correct noodle', () => {
    expect(carbSuspicion('Braised Rice Vermicelli', '炆米', [])).toBe(false);
  });

  // ── Ordinary dishes with no carb morpheme at all never fire ───────────────
  it('does NOT fire on 蝦餃 (har gow) — no carb shorthand present', () => {
    expect(carbSuspicion('Har gow', '水晶蝦餃', ['shrimp', 'bamboo shoot'])).toBe(false);
  });
  it('does NOT fire with empty / missing inputs', () => {
    expect(carbSuspicion(null, null, [])).toBe(false);
    expect(carbSuspicion('', '', [])).toBe(false);
  });
});

describe('carb-shorthand prompt hardening (cannot silently drop)', () => {
  it('the glossary names every shorthand it must expand and the key look-alike traps', () => {
    for (const s of ['米粉', '河粉', '意粉', '通粉', '出前一丁', '西多士', '炆米', '牛河']) {
      expect(HK_MENU_SHORTHAND_GUIDANCE).toContain(s);
    }
    for (const trap of ['粟米', '蝦米', '糯米', '河蝦', '雞丁', '通菜']) {
      expect(HK_MENU_SHORTHAND_GUIDANCE).toContain(trap);
    }
  });

  it('every perception prompt embeds the shorthand glossary — scan (×2), enrich, vision (×2)', () => {
    const sites = [...SCAN_PROMPTS, ENRICH_SYSTEM, ...VISION_PROMPTS];
    expect(sites.length).toBe(5);
    for (const p of sites) expect(p).toContain(HK_MENU_SHORTHAND_GUIDANCE);
  });

  it('the recheck line names the carb corrections so a re-ask can self-fix', () => {
    expect(CARB_RECHECK_LINE).toContain('米粉');
    expect(CARB_RECHECK_LINE).toContain('河粉');
  });
});
