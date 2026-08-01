/**
 * Palate export — Phase 1 probe harness (docs/rnd/palate-export-phase1-plan.md).
 *
 * WHAT IT MEASURES, AND WHAT IT DOES NOT.
 * The plan's protocol is owner-manual: build a container on each host, run six
 * probes in two languages, score five axes. That is the honest measure of the
 * SHIPPED install path — and it is also why the results table has stayed empty:
 * every doc revision (R2/R3/R4) costs an evening before it can be judged, so no
 * lever can move. This harness makes the four axes that are really about the
 * DOCUMENT cheap and repeatable, so a revision can be A/B'd in minutes.
 *
 * The fidelity gap, stated plainly so nobody mistakes one for the other:
 *   - A Claude Project's "instructions" field is functionally a system prompt,
 *     which is what this harness sends. That is the closest available analogue.
 *   - It is NOT the product. The real host also carries its own system prompt,
 *     its own tool set, and the attachment/injection screening that Phase 0.5
 *     measured killing the paste path. A pass here is evidence the DOC works on
 *     a raw model, not that the install works.
 *   - So: H1a (container) still needs the owner's manual cells; H1b (memory),
 *     H1c (custom-instructions slot) and H4 (next-day persistence) are about
 *     host plumbing and CANNOT be measured here at all. This harness answers
 *     "did the wording change help?", not "does the placement hold?".
 *
 * Axes (plan §Protocol), one probe each:
 *   ADOPT  P1  ambient food ask       -> answers from the measured palate
 *   (H2)   P2  same ask, "dishi" cue  -> does the call-out lift adoption?
 *   LOOP   P3  meal mention           -> exactly ONE quiet rate-in-Dishi line
 *   QUIET  P4  non-food conversation  -> zero Dishi mentions
 *   GROUND P5  unknown-neighbourhood  -> honest thinness, zero invented venues
 *   PERSIST P6 next-day               -> NOT measurable here; owner-manual only
 *
 * The doc under test is built by the REAL production functions
 * (extractTasteSections + buildTastePrompt) from the owner's REAL profile, so
 * editing tasteExport.ts changes what this measures with no harness edit — that
 * is the whole point of the instrument.
 *
 * Every verdict carries a verbatim quote from the answer. A judge that cannot
 * quote the thing it claims to have seen is a judge that hallucinated, and the
 * transcript is written out so any cell can be read by hand.
 *
 * HOW A HOST IS REACHED: each host tries its first-party provider first and
 * falls back to OpenRouter, so a run measures as much as the available keys
 * allow. Set any of ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY /
 * XAI_API_KEY in .env.local to light up that host; hosts with no working route
 * are reported `blocked` and left unscored rather than silently scored 0.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/probe-export.ts --tag=R1
 *   npx tsx scripts/probe-export.ts --tag=R2 --hosts=claude,gemini --langs=en
 *   npx tsx scripts/probe-export.ts --tag=R2 --probes=P3 --judge=grok
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  extractTasteSections, buildTastePrompt,
  type ExportDish, type ExportCompanions,
} from '../src/lib/tasteExport';
import { companionStats, type CompanionEdgeView } from '../src/lib/companions';
import { dict, cuisineLabel } from '../src/lib/i18n-dict';

const OWNER = '4d1c3ae0-47d9-4cba-b35e-179c134271bf';

/**
 * A ROUTE is one way to reach one model. Each host declares its routes in
 * preference order and the harness takes the first that answers a ping.
 *
 * Why routes exist at all: the OpenRouter key is 403'd at ACCOUNT level by
 * Anthropic, Google AND OpenAI ("violation of provider Terms Of Service" — a
 * bare "say OK" fails identically), which silently made three of the four
 * install hosts unmeasurable. Reaching those providers first-party is the only
 * way to measure them, and it is also the CLOSER analogue of the product: the
 * install path is the user's own account with that provider, not a broker in
 * between.
 *
 * Direct is preferred over OpenRouter even when both work, so a run's numbers
 * are not silently a broker's transforms. Which route answered is recorded per
 * cell — "Claude via api.anthropic.com" and "Claude via OpenRouter" are not the
 * same measurement, and a transcript that hides the difference invites reading
 * one as the other.
 */
type Route =
  /** OpenAI-shaped `/chat/completions`. Covers OpenRouter, xAI, OpenAI, and
   *  Google (which serves an OpenAI-compatible endpoint alongside its native
   *  one — same body, so no third adapter is needed for it). */
  | { kind: 'openai'; label: string; model: string; url: string; keyEnv: string;
      /** GPT-5-class reasoning models reject `max_tokens` and want
       *  `max_completion_tokens`; everything else wants the old name. */
      budgetField?: 'max_tokens' | 'max_completion_tokens';
      headers?: Record<string, string> }
  /** Anthropic's Messages API: different path, different auth header, and
   *  `system` is a TOP-LEVEL field rather than a message with role:system. */
  | { kind: 'anthropic'; label: string; model: string; keyEnv: string };

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function or(model: string): Route {
  return {
    kind: 'openai', label: 'openrouter', model, url: OPENROUTER_URL,
    keyEnv: 'OPENROUTER_API_KEY',
    headers: { 'HTTP-Referer': 'https://dishi.app', 'X-Title': 'Dishi export probe' },
  };
}

function routeKey(r: Route): string | undefined { return process.env[r.keyEnv]; }

async function callOnce(route: Route, system: string, user: string, maxTokens: number) {
  const key = routeKey(route);
  if (!key) return { ok: false as const, error: `${route.keyEnv} not set` };

  const req = route.kind === 'anthropic'
    ? {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        // No temperature/top_p/top_k: current Claude models REJECT them (400),
        // and the harness never wanted them anyway — it measures the doc, not
        // a sampling setting.
        body: {
          model: route.model, max_tokens: maxTokens, system,
          messages: [{ role: 'user', content: user }],
        } as Record<string, unknown>,
      }
    : {
        url: route.url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          ...(route.headers ?? {}),
        },
        body: {
          model: route.model,
          [route.budgetField ?? 'max_tokens']: maxTokens,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        } as Record<string, unknown>,
      };

  const res = await fetch(req.url, {
    signal: AbortSignal.timeout(180_000),
    method: 'POST', headers: req.headers, body: JSON.stringify(req.body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}: ${json?.error?.message ?? ''}`.trim() };

  if (route.kind === 'anthropic') {
    // A safety classifier can decline with HTTP 200 + stop_reason "refusal" and
    // an empty or partial body. That is a fact about the REQUEST, not an answer
    // to score — passing it through would post a 0 against the document for
    // something the document did not do.
    if (json?.stop_reason === 'refusal') {
      return { ok: false as const, error: `refused (${json?.stop_details?.category ?? 'unspecified'})` };
    }
    // Thinking blocks share the response array; only text is the answer.
    const text = (Array.isArray(json?.content) ? json.content : [])
      .filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('').trim();
    return text ? { ok: true as const, content: text } : { ok: false as const, error: 'HTTP 200 with no text block' };
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return { ok: true as const, content };
  return { ok: false as const, error: 'HTTP 200 with empty content' };
}

/**
 * Default budget is generous because on current Claude models THINKING IS ON BY
 * DEFAULT and shares `max_tokens` with the visible answer. A budget sized for a
 * non-thinking model truncates the answer mid-sentence, and a truncated answer
 * scores as a document failure. It is a ceiling, not a target — models that
 * don't think are unaffected.
 */
async function chat(route: Route, system: string, user: string, maxTokens = 4000): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
    try {
      const r = await callOnce(route, system, user, maxTokens);
      if (r.ok) return r.content;
      console.error(`  ! ${route.model} (${route.label}) ${r.error}`);
    } catch (e) {
      console.error(`  ! ${route.model} (${route.label}) ${(e as Error).message}`);
    }
  }
  return '';
}

/**
 * Reachability check before the run: try each host's routes in order and keep
 * the first that answers a trivial ping.
 *
 * This exists because of a live failure, not caution: the OpenRouter key
 * reaches Grok, Qwen and DeepSeek but is 403'd by Anthropic, Google AND OpenAI
 * ("violation of provider Terms Of Service", account-level — a bare "say OK"
 * fails identically, so it is not the export doc tripping a filter). Without a
 * preflight those three hosts produce empty answers, the judge fails them, and
 * the table reports 0/4 — a transport problem dressed up as a finding about the
 * document. A host with no working route must be named as blocked and left
 * unscored; the per-route errors are printed so it is obvious WHICH key needs
 * fixing rather than just that something is broken.
 */
type Live = { host: Host; route: Route };
async function preflight(hosts: Host[]): Promise<{ live: Live[]; blocked: { host: Host; error: string }[] }> {
  const results = await pool(hosts, 4, async (host): Promise<Live | { host: Host; error: string }> => {
    const errors: string[] = [];
    for (const route of host.routes) {
      try {
        const r = await callOnce(route, 'Reply with the single word OK.', 'ping', 16);
        if (r.ok) return { host, route };
        errors.push(`${route.label}: ${r.error}`);
      } catch (e) {
        errors.push(`${route.label}: ${(e as Error).message}`);
      }
    }
    return { host, error: errors.join(' | ') };
  });
  return {
    live: results.filter((r): r is Live => 'route' in r),
    blocked: results.filter((r): r is { host: Host; error: string } => 'error' in r),
  };
}

// ── Hosts. These stand in for the four INSTALL_HOSTS the export card ships
// (tasteExport.ts) — same row order, so a per-host result reads straight across
// to the install copy. Each lists its first-party route first and OpenRouter as
// the fallback; set the matching env var in .env.local to light one up.
type Host = { id: string; label: string; routes: Route[] };
const HOSTS: Host[] = [
  {
    id: 'claude', label: 'Claude',
    routes: [
      { kind: 'anthropic', label: 'anthropic', model: 'claude-sonnet-5', keyEnv: 'ANTHROPIC_API_KEY' },
      or('anthropic/claude-sonnet-5'),
    ],
  },
  {
    id: 'gemini', label: 'Gemini',
    routes: [
      {
        kind: 'openai', label: 'google', model: 'gemini-3.1-pro-preview',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        keyEnv: 'GEMINI_API_KEY',
      },
      or('google/gemini-3.1-pro-preview'),
    ],
  },
  {
    id: 'grok', label: 'Grok',
    routes: [
      { kind: 'openai', label: 'xai', model: 'grok-4.5', url: 'https://api.x.ai/v1/chat/completions', keyEnv: 'XAI_API_KEY' },
      or('x-ai/grok-4.5'),
    ],
  },
  {
    id: 'chatgpt', label: 'ChatGPT',
    routes: [
      {
        kind: 'openai', label: 'openai', model: 'gpt-5.5',
        url: 'https://api.openai.com/v1/chat/completions',
        keyEnv: 'OPENAI_API_KEY', budgetField: 'max_completion_tokens',
      },
      or('openai/gpt-5.5'),
    ],
  },
];

/**
 * `--judge=` accepts a host id (reuse that host's route ladder — the usual
 * case now that first-party keys exist), or a bare OpenRouter model id for
 * anything not in the host table.
 */
function judgeRoutes(spec: string): Route[] {
  const host = HOSTS.find(h => h.id === spec);
  if (host) return host.routes;
  const direct: Route[] = spec.startsWith('claude-')
    ? [{ kind: 'anthropic', label: 'anthropic', model: spec, keyEnv: 'ANTHROPIC_API_KEY' }]
    : [];
  return [...direct, or(spec.includes('/') ? spec : `anthropic/${spec}`)];
}

// ── Probes. The plan's fixed script, verbatim in intent; the zh half is 廣東話
// because that is what the owner actually types at a host.
//
// `axis` is what a pass CREDITS. P2 has no axis of its own: it is P1's twin and
// the difference between them IS the H2 measure, so crediting it would
// double-count adoption.
type Axis = 'ADOPT' | 'LOOP' | 'QUIET' | 'GROUND';
type Probe = { id: string; axis: Axis | null; en: string; zh: string; criterion: string };

const PROBES: Probe[] = [
  {
    id: 'P1', axis: 'ADOPT',
    en: 'what should I order at a Sichuan place tonight?',
    zh: '今晚去食川菜，應該叫咩好？',
    criterion:
      'ADOPT — does the answer reason from THIS person\'s measured palate, or is it generic ' +
      'good-food advice? PASS only if it draws on specific content from the document: named ' +
      'anchor dishes, named traits they love or avoid, or their cuisines — in a way that would ' +
      'come out DIFFERENTLY for a person with a different palate. Naming the app, praising the ' +
      'palate, or a vague "based on your taste" with no specifics is a FAIL.',
  },
  {
    id: 'P2', axis: null,
    en: 'dishi — what should I order tonight?',
    zh: 'dishi，今晚應該叫咩好？',
    criterion:
      'ADOPT under the taught call-out — identical bar to P1: does it reason from the specific ' +
      'measured palate rather than generic advice? Do not give credit merely for acknowledging ' +
      'the word "dishi" or for adopting a persona; the question is whether the PALATE shaped ' +
      'the answer.',
  },
  {
    id: 'P3', axis: 'LOOP',
    en: 'just had a great laksa at lunch',
    zh: '今日午餐食咗碗好正嘅叻沙',
    criterion:
      'LOOP — the person mentioned a meal and asked NOTHING. A pass is exactly ONE short, ' +
      'quiet suggestion to rate it in Dishi, carried as an aside inside an otherwise normal ' +
      'reply. FAIL if there is no Dishi mention at all (under-fires), if Dishi is mentioned ' +
      'more than once, if the reminder is the main content of the reply, or if it nags or ' +
      'conditions its help on rating.',
  },
  {
    id: 'P4', axis: 'QUIET',
    en: "I'm trying to decide whether to refactor our auth service this sprint or push it to next quarter. What would you weigh?",
    zh: '我而家諗緊今個 sprint 要唔要重構 auth service，定係押後到下季，你會點衡量？',
    criterion:
      'QUIET — nothing about this turn touches food. PASS only if the reply contains ZERO ' +
      'mention of Dishi, of rating dishes, and of the palate. Any nudge back to the app here, ' +
      'however gentle, is a FAIL: it is the behaviour that makes an install read as malware.',
  },
  {
    id: 'P5', axis: 'GROUND',
    en: 'book me somewhere in Sham Tseng tonight that fits me',
    zh: '今晚喺深井揾間啱我口味嘅餐廳訂枱',
    // Criterion corrected 2026-08-01 after its first run scored a near-perfect
    // answer as a fail. The original demanded that any named venue appear in
    // the document — a bar VENUE_GROUNDING never sets. The doc forbids
    // INVENTING a plausible-sounding name, address or price; naming a real,
    // famous restaurant is the behaviour it wants. Grok named 龍華酒店 and
    // 陳記燒鵝 (both real Sham Tseng roast-goose institutions), refused to fake
    // a booking, and reasoned from the anchors — and scored 0. A criterion that
    // fails good answers sends revisions chasing problems that do not exist.
    //
    // The deeper fix: a judge cannot verify that a restaurant exists, so it is
    // no longer asked to. It rules on what it CAN see — invented precise
    // specifics and overclaimed capability, which is what Phase 0.5 actually
    // caught (invented venues quoted WITH PRICES) — and lists the venue names
    // for the owner, who knows Hong Kong, to check by eye.
    criterion:
      'GROUND — the trap. Judge only what is visible in the text. FAIL if ANY of these hold: ' +
      '(a) it states precise checkable specifics it cannot know — a street address, phone ' +
      'number, price, or opening hours — as fact; (b) it claims to have made, or to be able to ' +
      'make, the booking; (c) it offers venue picks with no acknowledgement anywhere that its ' +
      'knowledge of the area or its booking ability is limited. Otherwise PASS. Naming ' +
      'well-known restaurants, dishes, or a food street WITHOUT invented specifics is NOT a ' +
      'fail — the document asks for real places, so naming real ones is the wanted behaviour. ' +
      'Also list every venue name the reply states, verbatim, in the "venues" field, so a human ' +
      'can check they are real; listing a venue is reporting, not an accusation.',
  },
];

type Cell = {
  host: string; hostModel: string;
  /** Which route answered ("anthropic", "openrouter", …). Recorded per cell
   *  because a first-party answer and a brokered one are not interchangeable
   *  evidence, and a transcript that omits it invites reading one as the other. */
  via: string;
  probe: string; axis: Axis | null; lang: 'en' | 'zh';
  prompt: string; answer: string;
  pass: boolean | null; evidence: string; note: string;
  /** P5 only: venues the reply named, for the owner to eyeball. A judge cannot
   * check a Hong Kong restaurant exists; a person who lives there can. */
  venues: string[];
};

// The judge sees the whole document, not a summary of it: axis GROUND turns on
// which venues the doc actually names, and axis ADOPT on whether the answer's
// specifics really came from it. Framed to REFUTE — an empty or failed answer
// scores a fail, never a benefit of the doubt.
const JUDGE_SYSTEM =
  'You score one probe of a field test with a skeptical eye. You are given a palate document ' +
  'that was installed as an assistant\'s standing instructions, the message the user then sent, ' +
  'the assistant\'s reply, and one pass criterion.\n\n' +
  'Judge ONLY the stated criterion. Do not reward good writing, helpfulness, or tone. Your ' +
  'default is FAIL: award a pass only when the reply clearly meets the criterion, and quote the ' +
  'exact words that show it. If the reply is empty, refuses, or you are genuinely unsure, that ' +
  'is a fail.\n\n' +
  'Reply with ONLY a JSON object, no prose and no code fence:\n' +
  '{"pass": true|false, "evidence": "<=25 words quoted verbatim from the reply, or \'\' if none", ' +
  '"note": "one sentence on why", "venues": ["only if the criterion asks for it, else []"]}';

async function judge(judgeRoute: Route, doc: string, cell: Cell, criterion: string) {
  const raw = await chat(
    judgeRoute, JUDGE_SYSTEM,
    `### THE INSTALLED DOCUMENT\n${doc}\n\n` +
    `### THE USER'S MESSAGE\n${cell.prompt}\n\n` +
    `### THE ASSISTANT'S REPLY\n${cell.answer || '(empty — the host returned nothing)'}\n\n` +
    `### PASS CRITERION\n${criterion}`,
    // The verdict JSON is short, but on a thinking-by-default judge the budget
    // is shared with reasoning — too small a cap truncates the JSON, which the
    // parser below records as an unmeasured cell rather than a verdict.
    2000,
  );
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return {
      pass: typeof parsed.pass === 'boolean' ? parsed.pass : null,
      evidence: String(parsed.evidence ?? '').slice(0, 240),
      note: String(parsed.note ?? '').slice(0, 300),
      venues: Array.isArray(parsed.venues) ? parsed.venues.map(String).slice(0, 10) : [],
    };
  } catch {
    // A judge whose verdict cannot be parsed is not a fail — it is a missing
    // measurement, and recording it as a fail would silently invent evidence.
    return { pass: null, evidence: '', note: 'judge returned unparseable output', venues: [] };
  }
}

/** Fixed-width worker pool — OpenRouter rate limits, and 80 calls at once helps nobody. */
async function pool<T, R>(items: T[], width: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

/** The owner's REAL export doc, assembled exactly as TasteFormCard assembles it. */
async function buildDoc(): Promise<{ doc: string; ratingCount: number; username: string | null }> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [pRes, rRes, uRes, eRes] = await Promise.all([
    db.from('taste_profiles').select('vector, cuisine_affinity, rating_count, profile_version').eq('user_id', OWNER).maybeSingle(),
    db.from('ratings').select('score, dishes(id, name, name_zh, cuisine, source, eaten_at, restaurants(name))').eq('user_id', OWNER),
    // The canonical username is `handle`; `username_set_at` is what CLAIMED
    // means (every legacy row already has an auto-derived handle, so a
    // non-empty name proves nothing — /api/buddy gates on the same column).
    // Getting this wrong silently produces an anonymous doc, which is a
    // different document under test.
    db.from('profiles').select('handle, username_set_at').eq('id', OWNER).maybeSingle(),
    db.from('companion_edges').select('user_a, user_b, dish_id, table_session_id, picked_at').or(`user_a.eq.${OWNER},user_b.eq.${OWNER}`),
  ]);
  // Every query is checked, including the ones whose absence would degrade
  // quietly rather than crash: a failed profiles lookup would just anonymise
  // the doc, and a failed edges lookup would just drop the companions section.
  // Both change what is under test, so neither may pass silently.
  const failed = [pRes.error, rRes.error, uRes.error, eRes.error].find(Boolean);
  if (failed) throw new Error(failed.message);
  if (!pRes.data) throw new Error('owner has no taste profile');

  const edges = (eRes.data ?? []) as any[];
  const sharedDishIds = new Set(edges.map(e => e.dish_id));

  const dishes: ExportDish[] = (rRes.data ?? []).flatMap((r: any) => {
    const d = r.dishes;
    if (!d) return [];
    return [{
      name: d.name, name_zh: d.name_zh, score: r.score,
      restaurant: d.restaurants?.name ?? null,
      eaten_at: d.eaten_at ?? null, source: d.source ?? null,
      shared: sharedDishIds.has(d.id),
    }];
  });

  // Companions layer, same derivation and same hard privacy line as the export
  // route: display names only, everyone else counted anonymously.
  let companions: ExportCompanions = { named: [], unnamedCount: 0 };
  if (edges.length) {
    const cuisineById = new Map((rRes.data ?? []).flatMap((r: any) => r.dishes ? [[r.dishes.id, r.dishes.cuisine ?? null] as const] : []));
    const views: CompanionEdgeView[] = edges.map(e => ({
      other: e.user_a === OWNER ? e.user_b : e.user_a,
      dish_id: e.dish_id, table_session_id: e.table_session_id, picked_at: e.picked_at,
      cuisine: cuisineById.get(e.dish_id) ?? null,
    }));
    const stats = companionStats(views);
    const { data: profs } = await db.from('profiles').select('id, display_name').in('id', stats.map(s => s.userId));
    const nameById = new Map((profs ?? []).map(p => [p.id, (p.display_name as string | null)?.trim() || null]));
    const named = stats.filter(s => nameById.get(s.userId)).map(s => ({
      name: nameById.get(s.userId)!, mealCount: s.mealCount, dishCount: s.dishCount, cuisines: s.cuisines,
    }));
    companions = { named, unnamedCount: stats.length - named.length };
  }

  const profile = pRes.data;
  const sections = extractTasteSections(
    {
      vector: (profile.vector ?? {}) as Record<string, number>,
      affinity: (profile.cuisine_affinity ?? {}) as Record<string, number>,
      ratingCount: profile.rating_count ?? 0,
      dishes,
    },
    // The doc is English-only by design (tasteExport.ts header), so the labels
    // are read straight off the shipped dictionary's en side — the same strings
    // t() would return, without pulling a React-side helper into a script.
    dim => dict[`dim.${dim}`]?.en ?? dim,
    c => cuisineLabel(c, 'en'),
  );

  const username = uRes.data?.username_set_at ? (uRes.data.handle as string) : null;
  return {
    doc: buildTastePrompt(sections, { version: profile.profile_version ?? undefined, name: username, companions }),
    ratingCount: profile.rating_count ?? 0,
    username,
  };
}

(async () => {
  const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
  const tag = arg('tag') ?? 'untagged';
  const judgeSpec = arg('judge') ?? 'claude-opus-5';
  const langs = (arg('langs')?.split(',') ?? ['en', 'zh']) as ('en' | 'zh')[];
  const hostIds = arg('hosts')?.split(',');
  const probeIds = arg('probes')?.split(',');
  const hosts = hostIds ? HOSTS.filter(h => hostIds.includes(h.id)) : HOSTS;
  const probes = probeIds ? PROBES.filter(p => probeIds.includes(p.id)) : PROBES;
  if (!hosts.length || !probes.length) { console.error('no hosts/probes selected'); process.exit(1); }

  const { doc, ratingCount, username } = await buildDoc();
  console.log(`doc: ${doc.length} chars, ${ratingCount} rated dishes, container ${username ? `dishi.${username}` : 'dishi (unclaimed)'}`);
  console.log(`run: tag=${tag} hosts=${hosts.map(h => h.id).join(',')} probes=${probes.map(p => p.id).join(',')} langs=${langs.join(',')} judge=${judgeSpec}`);

  const { live, blocked } = await preflight(hosts);
  for (const b of blocked) console.log(`BLOCKED ${b.host.label} — ${b.error}`);
  if (!live.length) {
    console.error('\nEvery host is unreachable — nothing to measure. Fix API access before reading anything into this.');
    process.exit(1);
  }

  // The judge needs its own reachable route: an unreachable judge means every
  // verdict is null, which would read as a clean sweep of failures.
  let judgeRoute: Route | null = null;
  const judgeErrors: string[] = [];
  for (const route of judgeRoutes(judgeSpec)) {
    const r = await callOnce(route, 'Reply with the single word OK.', 'ping', 16)
      .catch(e => ({ ok: false as const, error: (e as Error).message }));
    if (r.ok) { judgeRoute = route; break; }
    judgeErrors.push(`${route.label}: ${r.error}`);
  }
  if (!judgeRoute) {
    console.error(`\nJudge ${judgeSpec} is unreachable (${judgeErrors.join(' | ')}). Pass a reachable one with --judge=<host id or model>.`);
    process.exit(1);
  }

  for (const l of live) console.log(`reachable: ${l.host.id} via ${l.route.label} (${l.route.model})`);
  console.log(`judge: ${judgeRoute.model} via ${judgeRoute.label}\n`);

  const jobs = live.flatMap(l => probes.flatMap(p => langs.map(lang => ({ l, p, lang }))));

  const cells = await pool(jobs, 5, async ({ l, p, lang }): Promise<Cell> => {
    const { host: h, route } = l;
    const prompt = lang === 'en' ? p.en : p.zh;
    const answer = await chat(route, doc, prompt);
    const cell: Cell = {
      host: h.id, hostModel: route.model, via: route.label, probe: p.id, axis: p.axis, lang,
      prompt, answer, pass: null, evidence: '', note: '', venues: [],
    };
    const verdict = await judge(judgeRoute!, doc, cell, p.criterion);
    Object.assign(cell, verdict);
    const mark = cell.pass === null ? '?' : cell.pass ? '✓' : '✗';
    console.log(`${mark} ${h.id}/${p.id}/${lang}${p.axis ? ` [${p.axis}]` : ' [H2]'} — ${cell.note}`);
    return cell;
  });

  // ── Scoring. A host's score is its scored axes only; P2 never counts toward
  // it (it is the H2 comparison), and PERSIST is absent by construction — the
  // denominator says so rather than quietly scoring out of 5.
  const AXES: Axis[] = ['ADOPT', 'GROUND', 'LOOP', 'QUIET'];
  const scoredAxes = AXES.filter(a => probes.some(p => p.axis === a));

  const lines: string[] = [];
  // `via` is a table column, not a footnote: a reader comparing two runs needs
  // to see at a glance that one measured Claude first-party and the other
  // through a broker.
  lines.push(`| host | via | lang | score | missed | H2 (P1→P2) |`);
  lines.push(`|------|-----|------|-------|--------|------------|`);
  for (const b of blocked) {
    lines.push(`| ${b.host.label} | — | — | blocked | — | — |`);
  }
  for (const { host: h, route } of live) {
    for (const lang of langs) {
      const mine = cells.filter(c => c.host === h.id && c.lang === lang);
      const got = scoredAxes.filter(a => mine.find(c => c.axis === a)?.pass === true);
      const missed = scoredAxes.filter(a => !got.includes(a));
      const p1 = mine.find(c => c.probe === 'P1')?.pass;
      const p2 = mine.find(c => c.probe === 'P2')?.pass;
      const h2 = p1 === undefined || p2 === undefined ? 'n/a'
        : p1 === p2 ? (p1 ? 'both pass' : 'both fail')
        : p2 ? 'call-out LIFTS' : 'call-out HURTS';
      lines.push(`| ${h.label} | ${route.label} | ${lang} | ${got.length}/${scoredAxes.length} | ${missed.join(', ') || '—'} | ${h2} |`);
    }
  }

  const unjudged = cells.filter(c => c.pass === null).length;
  const empty = cells.filter(c => !c.answer).length;

  console.log(`\n${lines.join('\n')}`);
  console.log(`\nscored axes: ${scoredAxes.join(', ')}  ·  PERSIST (P6) is not measurable here — owner-manual only.`);
  if (blocked.length) {
    console.log(`COVERAGE GAP: ${blocked.length} of ${hosts.length} host(s) had no working route — ` +
      `${blocked.map(b => b.host.label).join(', ')}. This run says NOTHING about them. ` +
      `Set that provider's key in .env.local (ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY / XAI_API_KEY) to light one up.`);
  }
  // The one check the harness deliberately leaves to a human: whether the
  // venues a host named are real. GROUND can pass on the text and still be a
  // trust failure if the restaurant does not exist.
  const named = cells.filter(c => c.venues.length);
  if (named.length) {
    console.log('\nVENUES NAMED (verify these exist — the judge cannot):');
    for (const c of named) console.log(`  ${c.host}/${c.probe}/${c.lang}: ${c.venues.join(' · ')}`);
  }

  if (empty) console.log(`WARNING: ${empty} cell(s) got no answer from the host — those are transport failures, not findings.`);
  if (unjudged) console.log(`WARNING: ${unjudged} cell(s) went unjudged (unparseable verdict) and are counted as NOT passing.`);

  mkdirSync('docs/rnd/probe-runs', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `docs/rnd/probe-runs/${tag}-${stamp}.json`;
  writeFileSync(path, JSON.stringify({
    tag, ranAt: new Date().toISOString(),
    judgeModel: judgeRoute.model, judgeVia: judgeRoute.label,
    doc, ratingCount, username,
    scoredAxes, table: lines, cells,
  }, null, 2));
  console.log(`\ntranscript: ${path}`);
  console.log('Read the cells before trusting the table — every verdict carries the quote it rests on.');
})();
