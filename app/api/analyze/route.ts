import { NextRequest, NextResponse } from 'next/server';
import { analyzeCandles, type Candle, type Timeframe } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

type TwelveRow = { datetime: string; open: string; high: string; low: string; close: string };

async function fetchCandles(apiKey: string, interval: string): Promise<Candle[]> {
  const url =
    'https://api.twelvedata.com/time_series?symbol=EUR/USD&interval=' +
    interval +
    '&outputsize=100&apikey=' +
    encodeURIComponent(apiKey);
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (data.status === 'error' || !Array.isArray(data.values)) {
    throw new Error(data.message || 'Twelve Data returned an error.');
  }
  const rows: TwelveRow[] = data.values;
  // Twelve Data returns newest first. Reverse to oldest first for the maths.
  return rows
    .map((r) => ({
      datetime: r.datetime,
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    }))
    .reverse()
    .filter((c) => Number.isFinite(c.close));
}

async function groqExplain(apiKey: string, a: ReturnType<typeof analyzeCandles>): Promise<string | null> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.3,
        max_tokens: 120,
        messages: [
          {
            role: 'system',
            content:
              'You explain a forex signal in simple plain English. Use only the numbers given. Never give a percentage chance. Never say it will win. Two short sentences only.',
          },
          {
            role: 'user',
            content:
              'Pair EUR/USD, timeframe ' +
              a.timeframe +
              ', price ' +
              a.price.toFixed(4) +
              ', EMA20 ' +
              a.ema20.toFixed(4) +
              ', EMA50 ' +
              a.ema50.toFixed(4) +
              ', ATR14 ' +
              a.atrPips +
              ' pips, ADX ' +
              a.adx14 +
              ', support ' +
              a.support.toFixed(4) +
              ', resistance ' +
              a.resistance.toFixed(4) +
              ', score ' +
              a.score +
              ' out of 100, signal ' +
              a.signal +
              ', choppy ' +
              a.choppy +
              '.',
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const timeframe = (req.nextUrl.searchParams.get('timeframe') || '1h') as Timeframe;
  const tf: Timeframe = timeframe === '4h' ? '4h' : '1h';
  const other: Timeframe = tf === '1h' ? '4h' : '1h';
  const tdKey = process.env.TWELVE_DATA_API_KEY;

  if (!tdKey) {
    return NextResponse.json(
      {
        error: 'missing_key',
        message:
          'No Twelve Data key set. Add TWELVE_DATA_API_KEY in Vercel under Settings, Environment Variables, then redeploy. No live price is shown without it.',
      },
      { status: 400 }
    );
  }

  try {
    const [candles, otherCandles] = await Promise.all([
      fetchCandles(tdKey, tf),
      fetchCandles(tdKey, other),
    ]);
    if (candles.length < 60) {
      return NextResponse.json({ error: 'not_enough_data', message: 'Not enough price data came back. Try again.' }, { status: 502 });
    }
    const analysis = analyzeCandles(candles, otherCandles, tf);
    let explanation: string | null = null;
    if (process.env.GROQ_API_KEY) {
      explanation = await groqExplain(process.env.GROQ_API_KEY, analysis);
    }
    return NextResponse.json({ ...analysis, explanation });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Price data failed to load.';
    return NextResponse.json({ error: 'data_failed', message }, { status: 502 });
  }
}
