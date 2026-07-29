import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { formatScanSummary, sanitizeScanSummary } from '@/lib/scanTelemetry';

/**
 * POST /api/scan-telemetry — the intake for the one-line-per-scan latency
 * record (see lib/scanTelemetry.ts for why this exists at all).
 *
 * It only logs. No DB write, deliberately: the value here is a greppable line
 * in the runtime logs next to the stage-1 line the scan route already emits,
 * and a table would invite a dashboard nobody has asked for yet. If this
 * proves its worth, persisting it is a later, separate decision.
 *
 * Authenticated because it writes to the logs — an open logging endpoint is a
 * free denial-of-wallet and a log-spam vector. The payload is sanitized on top
 * of that (sanitizeScanSummary), since a signed-in client is still untrusted
 * input when its strings land in a log line.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: 'Bad payload.' }, { status: 400 });

  console.log(formatScanSummary(sanitizeScanSummary(raw)));
  return NextResponse.json({ ok: true });
}
