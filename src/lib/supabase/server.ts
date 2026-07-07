import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/** Request-scoped client that respects the caller's auth (RLS applies). */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
<<<<<<< HEAD
        // Explicit any[] type required: implicit-any here breaks the production
        // TypeScript build (fixed by Jerry — do not revert).
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
        setAll: (all: any[]) => all.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    }
  );
}

/** Service-role client for cross-user reads/writes (recommendations, points). Server only. */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
