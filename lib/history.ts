export type HistoryEntry = {
  id: string;
  time: string;
  pair: string;
  timeframe: '1h' | '4h';
  direction: 'BUY' | 'SELL' | 'WAIT';
  score: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
};

export const HISTORY_KEY = 'd247-history';

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: HistoryEntry) {
  try {
    const list = loadHistory();
    // Do not save the same candle twice: one entry per timeframe and candle time.
    if (list.some((e) => e.time === entry.time && e.timeframe === entry.timeframe)) return;
    list.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    // Storage full or unavailable: history is a bonus, the page must not fail.
  }
}
