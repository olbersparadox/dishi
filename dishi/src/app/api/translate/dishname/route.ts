import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { translateDishName } from '@/lib/translate';

/**
 * POST /api/translate/dishname { text: string } -> { translated: string | null }
 * Auth-gated purely to keep this from being an open, unauthenticated proxy to the
 * LLM — the translation itself has nothing user-specific about it.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required.' }, { status: 400 });
  }

  const translated = await translateDishName(text.slice(0, 120));
  return NextResponse.json({ translated });
}
