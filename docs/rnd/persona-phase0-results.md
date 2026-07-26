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
2. **Paste flow = the taster.** One-conversation meet-the-character, ending with the install upsell + per-host instructions. — **SUPERSEDED by Phase 0.5 §4 (2026-07-26): the taster path is dead, the export is install-only.** Left as written because it was the honest read of the Phase 0 evidence.
3. **Summon-phrase fallback is STRUCK** from the design (name-collision + memory-compression evidence above).
4. **Dismissal scoping becomes a hard rule in the doc:** 收聲 silences for the current conversation only; the doc must explicitly instruct the host never to store any dismissal as a standing/permanent instruction (Gemini topic-ban incident as the reference case).
5. **Marketing asset:** the Gemini Wan Chai screenshots (same person, same question, with/without dishi — sourdough-and-desserts vs anchor-reasoned picks) are a ready-made before/after acquisition visual. Filed for the positioning deck.

---

# Phase 0.5 results — the install path, tested after the fixes (2026-07-26)

Owner's own field testing of the post-`4540c60` export doc, on the surfaces Phase 0 pointed at. Phase 0 above is left exactly as written: it was true of what was tested then. Where the two conflict, this section is the later evidence and wins — most importantly on point 2 of the verdict.

## 1. The install path WORKS, unprompted

Fresh conversation inside a Claude Project (Sonnet 5), doc in the instructions field, no invocation of any kind: the persona adopted on its own. It named itself, cited a real anchor (炒蝦 at 雀友茶樓), mirrored to Cantonese on request, and reasoned from the actual vector rather than from trait words — post-drink wants 嫩滑/鮮味, avoid 重油重甜, offering 豉油雞腩配靚白飯 as kin to the profile's 油雞髀腩仔飯. One hook, then it stopped. A Gemini Gem: full adoption, all house rules held.

This is the behaviour Phase 0 predicted a container would give, now observed rather than inferred.

## 2. The fix was 3c + 3d (`4540c60`) — command grammar was the blocker

The same surface with the OLD doc produced zero adoption ("I'm Claude, made by Anthropic"). The host's own visible reasoning showed it weighing persona adoption against injection patterns and resolving to adopt once the doc explained where it came from. **Honest provenance was the fix; imperative command grammar was what hosts refused.** That is a design rule for anything the app ever asks a foreign host to run.

## 3. Handshake compression is ACCEPTABLE, not a defect

Asked by a hungry user, the persona skipped the ceremony and answered the question. Recorded explicitly so a later pass doesn't "fix" it: a persona exercising judgment about its own protocol is stronger evidence of adoption than one reciting the protocol.

## 4. The taster path is CATEGORICALLY DEAD — supersedes Phase 0 verdict point 2

Phase 0 concluded "paste flow = the taster." It isn't, and cannot be made into one:

- The app's copy button feeds the mobile chat composer, which auto-converts a long paste into a TXT attachment. **The user cannot prevent this** — it is composer behaviour, not something copy can instruct around.
- A host declined to auto-adopt behavioural instructions arriving inside a pasted document. The refusal was explicitly **channel-based, not content-based**, and held even for a document the user authored themselves.
- The provenance preamble that rescued the install path does NOT rescue this one — provenance answers "who wrote this," and the objection is "how it arrived."

**The export is install-only.** No taster, no one-conversation meet-the-character.

*(Scope note: the auto-attachment problem belongs to the CHAT COMPOSER and therefore only to this dead path. The `INSTALL_HOSTS` paste-as-TEXT guidance shipped in `4540c60` is about a different surface — a Project/Gem/GPT instructions box is a settings field that cannot hold an attachment, while those hosts do offer a separate knowledge/file upload beside it. That copy is correct where it lives and stays.)*

## 5. Payload/costume split — hosts take the data, refuse the character

Pre-fix, one host took the taste DATA (vector, anchors, cuisines) and declined the character SYSTEM (the named alter-ego, the marked blocks, the 收聲 trigger). The split is clean and it is the finding the export-positioning decision acts on: taste learning travels; a character does not travel reliably.

## 6. Grounding is host-dependent — and conviction makes fabrication worse

- **Claude, tool-grounded:** 100% real venues, and it volunteered "no claypot worth naming in soho tonight, so don't chase that one here" — the no-irrelevant-rec principle enforced in character, unprompted, by a foreign host.
- **Gemini, in character:** invented 滿福樓, 中華小館 and 豪隍點心茶居, with prices, presented as taste-matched picks.

A persona speaks with conviction, which makes a fabricated venue MORE convincing, not less. This is a binding constraint on any in-app persona work: anything a persona names must be Places-verified, never model-recalled.

## 7. Incognito is the wrong place to install

Nothing persists. App copy must never suggest it.

## Still open (owner manual, not code)

ChatGPT custom GPT with the post-fix doc — never retested. BACKLOG item 4 stays open for that alone.
