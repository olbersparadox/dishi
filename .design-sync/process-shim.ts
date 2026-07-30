// Must stay the FIRST import in entry.tsx — see the comment there.
//
// esbuild substitutes only the exact expression `process.env.NODE_ENV`. Every
// other `process.env.*` read survives into the browser bundle, where `process`
// is undefined, so the IIFE throws while evaluating and window.Dishi is never
// assigned — which surfaces as all 52 cards blank plus [BUNDLE_EXPORT].
//
// Reachable from the barrel: next/link's router internals (__NEXT_*) via
// PickedCartBar and PublicDish, Supabase's browser client via useInteractions
// (DailyInteractions, InteractionRow), and OpenRouter via menuScan
// (DishInfoDisplay).
//
// The Supabase values are syntactically-valid placeholders, not credentials:
// createBrowserClient throws on a malformed URL at construction time, and
// construction is all that happens here. No preview ever issues a request —
// the components that would are excluded from this sync precisely because they
// need live data.
const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
g.process = g.process ?? {};
g.process.env = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'design-sync-placeholder-not-a-key',
  SUPABASE_SECRET_KEY: 'design-sync-placeholder-not-a-key',
  OPENROUTER_MODEL: 'design-sync-placeholder',
  ...g.process.env,
};

export {};
