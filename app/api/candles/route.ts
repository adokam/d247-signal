import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Used by the History page to check old signals against fresh candles.
// Returns candles oldest first. Never invents a price.
export async function GET(req: NextRequest) {
  const interval = req.nextUrl.searchParams.get('interval') || '1h';
  const tdKey = process.env.TWELVE_DATA_API_KEY;
  if (!tdKey) {
    return NextResponse.json({ error: 'missing_key', message: 'No Twelve Data key set.' }, { status: 400 });
  }
  try {
    const url =
      'https://api.twelvedata.com/time_series?symbol=EUR/USD&interval=' +
      encodeURIComponent(interval) +
      '&outputsize=100&apikey=' +
      encodeURIComponent(tdKey);
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (data.status === 'error' || !Array.isArray(data.values)) {
      throw new Error(data.message || 'Twelve Data returned an error.');
    }
    const candles = data.values
      .map((r: { datetime: string; open: string; high: string; low: string; close: string }) => ({
        datetime: r.datetime,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
      }))
      .reverse()
      .filter((c: { close: number }) => Number.isFinite(c.close));
    return NextResponse.json({ candles });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Price data failed to load.';
    return NextResponse.json({ error: 'data_failed', message }, { status: 502 });
  }
}
