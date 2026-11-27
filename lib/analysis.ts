// D247 Signal - analysis rules, all from price candles. No magic.
// Score starts at 50. Points are added only when trend, structure,
// volatility and timeframe agreement line up. Score is capped at 85
// and is never a true probability. A score of 62 means a stronger
// setup than usual, not a 62 percent chance of winning.

export type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Timeframe = '1h' | '4h';

export type Analysis = {
  pair: string;
  timeframe: Timeframe;
  price: number;
  candleTime: string;
  ema20: number;
  ema50: number;
  atr14: number;
  atrPips: number;
  adx14: number;
  support: number;
  resistance: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  choppy: boolean;
  score: number;
  label: 'Low' | 'Medium' | 'Strong';
  signal: 'BUY' | 'SELL' | 'WAIT';
  reasons: string[];
  entry: number;
  stopLoss: number;
  takeProfit: number;
  stopLossPips: number;
  takeProfitPips: number;
  otherTimeframeBias: 'bullish' | 'bearish' | 'neutral';
  otherTimeframe: Timeframe;
};

function ema(values: number[], period: number): number {
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    sum += Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  }
  return sum / period;
}

// Simple ADX(14). Low ADX means the market is ranging, not trending.
// When ADX is low and the recent range is small compared with ATR,
// the market is choppy and a moving-average style signal whipsaws.
function adx(candles: Candle[], period = 14): number {
  if (candles.length < period * 2 + 1) return 0;
  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
    const up = c.high - p.high;
    const down = p.low - c.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }
  let str = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let sPlus = plusDm.slice(0, period).reduce((a, b) => a + b, 0);
  let sMinus = minusDm.slice(0, period).reduce((a, b) => a + b, 0);
  const dx: number[] = [];
  for (let i = period; i < tr.length; i++) {
    str = str - str / period + tr[i];
    sPlus = sPlus - sPlus / period + plusDm[i];
    sMinus = sMinus - sMinus / period + minusDm[i];
    const plusDi = str === 0 ? 0 : (100 * sPlus) / str;
    const minusDi = str === 0 ? 0 : (100 * sMinus) / str;
    const sum = plusDi + minusDi;
    dx.push(sum === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / sum);
  }
  if (dx.length < period) return dx.length ? dx[dx.length - 1] : 0;
  return dx.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function biasOf(candles: Candle[]): 'bullish' | 'bearish' | 'neutral' {
  const closes = candles.map((c) => c.close);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const price = closes[closes.length - 1];
  if (e20 > e50 && price > e20) return 'bullish';
  if (e20 < e50 && price < e20) return 'bearish';
  return 'neutral';
}

function higherHighs(candles: Candle[]): boolean {
  // Last 10 candles make a higher high and a higher low than the 10 before them.
  const a = candles.slice(-20, -10);
  const b = candles.slice(-10);
  if (a.length < 10 || b.length < 10) return false;
  return Math.max(...b.map((c) => c.high)) > Math.max(...a.map((c) => c.high));
}

function lowerLows(candles: Candle[]): boolean {
  const a = candles.slice(-20, -10);
  const b = candles.slice(-10);
  if (a.length < 10 || b.length < 10) return false;
  return Math.min(...b.map((c) => c.low)) < Math.min(...a.map((c) => c.low));
}

export function analyzeCandles(candles: Candle[], other: Candle[], timeframe: Timeframe): Analysis {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const atrValue = atr(candles, 14);
  const atrPips = Math.round(atrValue * 10000);
  const adxValue = adx(candles, 14);
  const last50 = candles.slice(-50);
  const resistance = Math.max(...last50.map((c) => c.high));
  const support = Math.min(...last50.map((c) => c.low));
  const bias = biasOf(candles);
  const otherBias = biasOf(other);
  const otherTimeframe: Timeframe = timeframe === '1h' ? '4h' : '1h';

  // Regime filter: choppy when ADX is low and the last 20 candles
  // have not moved far compared with ATR.
  const last20 = candles.slice(-20);
  const range20 = Math.max(...last20.map((c) => c.high)) - Math.min(...last20.map((c) => c.low));
  const choppy = adxValue < 18 || (atrValue > 0 && range20 < 2.5 * atrValue);

  let score = 50;
  const reasons: string[] = [];

  if (bias === 'bullish') {
    score += 8;
    reasons.push('Trend is up: price is above the 20 EMA and the 20 EMA is above the 50 EMA.');
    if (higherHighs(candles)) {
      score += 5;
      reasons.push('Price is making higher highs and higher lows.');
    }
  } else if (bias === 'bearish') {
    score += 8;
    reasons.push('Trend is down: price is below the 20 EMA and the 20 EMA is below the 50 EMA.');
    if (lowerLows(candles)) {
      score += 5;
      reasons.push('Price is making lower highs and lower lows.');
    }
  } else {
    reasons.push('Trend is not clear: price is close to the moving averages.');
  }

  if (Math.abs(e20 - e50) > 0.0005) {
    score += 5;
  }
  if (adxValue >= 20) {
    score += 5;
    reasons.push('The move has strength: ADX is ' + Math.round(adxValue) + ', so it is trending, not flat.');
  }
  // Structure: near support for a buy, near resistance for a sell.
  if (bias === 'bullish' && atrValue > 0 && price - support < 1.5 * atrValue) {
    score += 5;
    reasons.push('Price is near recent support at ' + support.toFixed(4) + '.');
  }
  if (bias === 'bearish' && atrValue > 0 && resistance - price < 1.5 * atrValue) {
    score += 5;
    reasons.push('Price is near recent resistance at ' + resistance.toFixed(4) + '.');
  }
  if (otherBias === bias && bias !== 'neutral') {
    score += 5;
    reasons.push('H1 and H4 agree on the direction.');
  }

  if (choppy) {
    // Cap the score and force WAIT. A choppy market is where
    // moving-average signals lose the most.
    score = Math.min(score, 55);
    reasons.push('Market looks choppy right now, so it is safer to wait.');
  }

  score = Math.max(0, Math.min(85, Math.round(score)));

  let signal: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  if (!choppy && score >= 60 && bias === 'bullish') signal = 'BUY';
  else if (!choppy && score >= 60 && bias === 'bearish') signal = 'SELL';
  if (signal === 'WAIT' && reasons.length === 0) reasons.push('No clear setup right now.');

  const label: 'Low' | 'Medium' | 'Strong' = score >= 70 ? 'Strong' : score >= 60 ? 'Medium' : 'Low';

  const slDistance = 1.5 * atrValue;
  const tpDistance = 3.0 * atrValue;
  const stopLoss = signal === 'SELL' ? price + slDistance : price - slDistance;
  const takeProfit = signal === 'SELL' ? price - tpDistance : price + tpDistance;
  const stopLossPips = Math.round(slDistance * 10000);
  const takeProfitPips = Math.round(tpDistance * 10000);

  return {
    pair: 'EUR/USD',
    timeframe,
    price,
    candleTime: candles[candles.length - 1].datetime,
    ema20: e20,
    ema50: e50,
    atr14: atrValue,
    atrPips,
    adx14: Math.round(adxValue * 10) / 10,
    support,
    resistance,
    bias,
    choppy,
    score,
    label,
    signal,
    reasons: reasons.slice(0, 3),
    entry: price,
    stopLoss,
    takeProfit,
    stopLossPips,
    takeProfitPips,
    otherTimeframeBias: otherBias,
    otherTimeframe,
  };
}

// Lot size: risk dollars divided by (SL pips x $10 per pip per standard lot
// for EUR/USD). Rounded down to 0.01, minimum 0.01.
export function lotSize(balance: number, riskPercent: number, slPips: number): { lot: number; riskDollars: number } {
  const riskDollars = (balance * riskPercent) / 100;
  if (slPips <= 0) return { lot: 0.01, riskDollars };
  const raw = riskDollars / (slPips * 10);
  const lot = Math.max(0.01, Math.floor(raw * 100) / 100);
  return { lot, riskDollars };
}

export function evaluateSignal(
  entry: { direction: 'BUY' | 'SELL'; entry: number; stopLoss: number; takeProfit: number },
  candles: Candle[]
): 'WON' | 'LOST' | 'OPEN' {
  for (const c of candles) {
    const hitTp =
      entry.direction === 'BUY' ? c.high >= entry.takeProfit : c.low <= entry.takeProfit;
    const hitSl =
      entry.direction === 'BUY' ? c.low <= entry.stopLoss : c.high >= entry.stopLoss;
    if (hitTp && hitSl) {
      // Both hit in the same candle: the one closer to the open hit first.
      const distTp = Math.abs((entry.direction === 'BUY' ? entry.takeProfit : entry.takeProfit) - c.open);
      const distSl = Math.abs(entry.stopLoss - c.open);
      return distTp < distSl ? 'WON' : 'LOST';
    }
    if (hitTp) return 'WON';
    if (hitSl) return 'LOST';
  }
  return 'OPEN';
}
