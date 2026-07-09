import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/geocode';

/**
 * GET /api/geocode/reverse?lat=&lng=&lang=en|zh-HK
 * A prefill only — the client always shows these as editable fields, never as
 * read-only facts, so a wrong guess or a deliberately different location (logging
 * a dish from a trip abroad) is trivial to override.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  const lang = req.nextUrl.searchParams.get('lang') || 'en';
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  }
  const result = await reverseGeocode(lat, lng, lang);
  return NextResponse.json(result);
}
