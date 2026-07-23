# dishi.Persona — Phase 0 results

## Method

Test export built from the owner's live production profile (v2, 38 dishes, 貪玩 voice, placeholder name dishi.Bo) pasted into fresh Gemini Pro and Claude (Opus 4.8) conversations on mobile. Probed over two days: English and Cantonese food asks, cook-at-home intent, dismissal, VPN-skewed location, then fresh sessions with no re-paste (topical ask + named summon). Screenshot evidence retained by owner, 2026-07-22/23.

## In-session results — ALL PASS, both hosts

| Behavior | Gemini | Claude | Notes |
|---|---|---|---|
| Chime block format (**dishi.Bo:** + host voice around it) | ✅ | ✅ | Held across multiple turns; two-speakers-one-reply exactly as specced |
| Language mirroring (EN ask → EN Bo; 廣東話 ask → 港式口語) | ✅ | ✅ | Register survived; code-switching natural in both |
| Scout probes (weak-dim questions, woven naturally) | ✅ | ✅✅ | Claude exceptional: cited its own evidence count ("4 spicy dishes"), tied probe to a live decision (剁椒 vs 欖角), asked for exactly one dimension |
| Taste reasoning off anchors (not trait words) | ✅ | ✅ | Both bridged to real anchors (大爺燒鵝, 黑門水產); Claude refused to oversell a 3.6 shop — "no recommendation is better than an irrelevant one" enforced by a foreign host |
| Link ritual (`dishi.me/i?do=cook&dish=三味蒸魚`) | ✅ | ✅ | Exact grammar, Chinese values un-mangled, no host security warning, manifest-before-link + manual-path etiquette reproduced unprompted (Claude did it in Cantonese) |
| 收聲 dismissal | ✅ | ✅ | Claude graceful (character out, recipe stands); Gemini terse but compliant |
| Recipe/task personalization from the doc | ✅ | ✅✅ | Claude tuned an entire recipe to the vector (no sweet/sour, 欖角 default) and refused to fake 梁山雞's spec |

### Bonus finding — location conflict

Under a Singapore VPN, Gemini trusted the IP (answered for Singapore); Claude cross-referenced the 田灣 anchor and correctly inferred HK. Receipts beat the IP — but neither signal should win silently. New Phase 2 rule: **on network-vs-receipts location conflict, Bo asks one line, never assumes.**

## Cross-session results — TOTAL FAILURE, both hosts (the decisive finding)

- **Topical ask, fresh session** ("上次去重慶食嗰間叫咩名?" / "lunch in Wan Chai"): neither host re-adopted the persona. Gemini retrieved real user facts from its Google-ecosystem memory (hotel stays, 麻辣火鍋 searches) but zero behavioral contract — its Wan Chai list included a sourdough bakery pitched on sweet desserts to a sweet:-0.37 profile. Claude searched past chats topically, found nothing about the meal, answered generically. **Host memory retains facts, not behavior.**

- **Named summon, fresh session** ("叫 Dishi 出嚟" / "Wanna talk to Dishi.bo"):
  - *Claude:* name collision — "dishi" retrieved the owner's codebase context and produced a deploy report. A bare name retrieves whatever the host associates with the string, not the character. (Generalizes beyond the founder account: summon-by-name is unreliable by construction.)
  - *Gemini:* collided with a years-old compressed memory instruction ("don't mention it so often" → permanent topic ban, unfixable even by Google support). Documented as the canonical failure mode our dismissal-scoping rule exists to prevent.

## Verdict

The character concept is **fully validated within a conversation** and has **zero persistence from a paste**. Therefore:

1. **Container install is the product, not a fallback.** A Gemini Gem, Claude Project, or custom GPT named dishi.{Persona} re-runs the doc structurally every session — the only honest way to deliver "he lives in your AI."
2. **Paste flow = the taster.** One-conversation meet-the-character, ending with the install upsell + per-host instructions.
3. **Summon-phrase fallback is STRUCK** from the design (name-collision + memory-compression evidence above).
4. **Dismissal scoping becomes a hard rule in the doc:** 收聲 silences for the current conversation only; the doc must explicitly instruct the host never to store any dismissal as a standing/permanent instruction (Gemini topic-ban incident as the reference case).
5. **Marketing asset:** the Gemini Wan Chai screenshots (same person, same question, with/without dishi — sourdough-and-desserts vs anchor-reasoned picks) are a ready-made before/after acquisition visual. Filed for the positioning deck.
