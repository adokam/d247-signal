'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { evaluateSignal, type Candle } from '@/lib/analysis';
import { loadHistory, type HistoryEntry } from '@/lib/history';

type Row = HistoryEntry & { result: 'WON' | 'LOST' | 'OPEN' | 'UNKNOWN'; pips: number | null };

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState('Loading history...');

  useEffect(() => {
    async function run() {
      const entries = loadHistory();
      if (entries.length === 0) {
        setRows([]);
        setNote('No signals saved yet. Tap Refresh on the dashboard first.');
        return;
      }
      // Fetch fresh candles for each timeframe once, then check every
      // saved signal against the candles after its time.
      const out: Row[] = [];
      for (const tf of ['1h', '4h'] as const) {
        const list = entries.filter((e) => e.timeframe === tf);
        if (list.length === 0) continue;
        let candles: Candle[] = [];
        try {
          const res = await fetch('/api/candles?interval=' + tf, { cache: 'no-store' });
          const json = await res.json();
          if (res.ok && Array.isArray(json.candles)) candles = json.candles;
        } catch {}
        for (const e of list) {
          if (e.direction !== 'BUY' && e.direction !== 'SELL') {
            out.push({ ...e, result: 'OPEN', pips: null });
            continue;
          }
          const after = candles.filter((c) => c.datetime > e.time);
          if (after.length === 0) {
            out.push({ ...e, result: 'UNKNOWN', pips: null });
            continue;
          }
          const result = evaluateSignal(
            { direction: e.direction as 'BUY' | 'SELL', entry: e.entry, stopLoss: e.stopLoss, takeProfit: e.takeProfit },
            after
          );
          const pips =
            result === 'WON'
              ? Math.round(Math.abs(e.takeProfit - e.entry) * 10000)
              : result === 'LOST'
                ? -Math.round(Math.abs(e.entry - e.stopLoss) * 10000)
                : null;
          out.push({ ...e, result, pips });
        }
      }
      out.sort((a, b) => (a.time < b.time ? 1 : -1));
      setRows(out);
      const checked = out.filter((r) => r.result !== 'UNKNOWN');
      setNote(
        checked.length < out.length
          ? 'Some older signals are outside the last 100 candles, so they cannot be checked yet.'
          : 'Each signal was checked against later candles: TP hit first means won, SL hit first means lost.'
      );
    }
    run();
  }, []);

  const decided = rows.filter((r) => r.result === 'WON' || r.result === 'LOST');
  const won = rows.filter((r) => r.result === 'WON').length;
  const lost = rows.filter((r) => r.result === 'LOST').length;
  const winRate = decided.length ? Math.round((won / decided.length) * 100) : 0;
  const band = decided.filter((r) => r.score >= 60 && r.score <= 69);
  const bandWon = band.filter((r) => r.result === 'WON').length;

  return (
    <main className="wrap">
      <div className="top">
        <div>
          <h1>History</h1>
          <div className="sub">EUR/USD • Won or lost, checked later</div>
        </div>
        <Link href="/">Dashboard</Link>
      </div>

      <div className="box">
        <div className="sum">
          <div className="cell"><div className="small">Signals</div><b>{rows.length}</b></div>
          <div className="cell"><div className="small">Won</div><b>{won}</b></div>
          <div className="cell"><div className="small">Lost</div><b>{lost}</b></div>
        </div>
        <p style={{ textAlign: 'center' }}>
          Win rate {decided.length ? winRate + '%' : '—'} ({won} won out of {decided.length} decided)
        </p>
        <p className="small" style={{ textAlign: 'center' }}>
          Score 60 to 69: {bandWon} won out of {band.length} decided.
        </p>
        <p className="small">{note}</p>
      </div>

      {rows.map((r) => (
        <div className="row" key={r.id}>
          <div>
            <b>{r.time} • {r.direction}</b>
            <div className="small">
              Score {r.score} / 100 • {r.timeframe} • Entry {r.entry.toFixed(4)}
            </div>
          </div>
          <div className={r.result === 'WON' ? 'won' : r.result === 'LOST' ? 'lost' : 'open'}>
            {r.result === 'UNKNOWN' ? 'NOT CHECKED' : r.result}
            {r.pips !== null ? (r.pips > 0 ? ' +' + r.pips : ' ' + r.pips) + ' pips' : ''}
          </div>
        </div>
      ))}

      <footer>Educational tool, demo only. Not financial advice.</footer>
    </main>
  );
}
