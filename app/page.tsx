'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Analysis } from '@/lib/analysis';
import { lotSize } from '@/lib/analysis';
import { saveHistoryEntry } from '@/lib/history';

type Settings = { balance: number; riskPercent: number };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('d247-settings');
    if (raw) {
      const p = JSON.parse(raw);
      return {
        balance: Number(p.balance) > 0 ? Number(p.balance) : 10000,
        riskPercent: Number(p.riskPercent) > 0 ? Number(p.riskPercent) : 1,
      };
    }
  } catch {}
  return { balance: 10000, riskPercent: 1 };
}

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState<'1h' | '4h'>('1h');
  const [data, setData] = useState<(Analysis & { explanation?: string | null }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<Settings>({ balance: 10000, riskPercent: 1 });

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function saveSettings(s: Settings) {
    setSettings(s);
    try {
      localStorage.setItem('d247-settings', JSON.stringify(s));
    } catch {}
  }

  async function refresh(tf: '1h' | '4h') {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analyze?timeframe=' + tf, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setData(null);
        setError(json.message || 'Price data failed to load.');
        return;
      }
      setData(json);
      // Save this signal to history so it can be checked later as won or lost.
      if (json.signal === 'BUY' || json.signal === 'SELL') {
        saveHistoryEntry({
          id: tf + '-' + json.candleTime,
          time: json.candleTime,
          pair: 'EUR/USD',
          timeframe: tf,
          direction: json.signal,
          score: json.score,
          entry: json.entry,
          stopLoss: json.stopLoss,
          takeProfit: json.takeProfit,
        });
      }
    } catch {
      setData(null);
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const lot = data ? lotSize(settings.balance, settings.riskPercent, data.stopLossPips) : null;
  const cardClass = data ? (data.signal === 'BUY' ? 'buy' : data.signal === 'SELL' ? 'sell' : 'wait') : 'wait';

  return (
    <main className="wrap">
      <div className="top">
        <div>
          <h1>D247 Signal</h1>
          <div className="sub">EUR/USD • Manual check • Demo only</div>
        </div>
        <div className="price">
          <b>{data ? data.price.toFixed(4) : '— — — —'}</b>
          <div className="chg">{data ? 'Updated ' + new Date().toLocaleTimeString() : 'No price yet'}</div>
        </div>
      </div>

      <div className="tf">
        <button className={timeframe === '1h' ? 'on' : ''} onClick={() => setTimeframe('1h')}>H1</button>
        <button className={timeframe === '4h' ? 'on' : ''} onClick={() => setTimeframe('4h')}>H4</button>
      </div>

      {error ? (
        <div className="err">{error}</div>
      ) : data ? (
        <>
          <div className={'card ' + cardClass}>
            <div className="sig">{data.signal}</div>
            <div className="score">Score {data.score} / 100 • {data.label} confidence</div>
            <div className="note">Not a promise, this setup can still lose.</div>
          </div>

          <div className="box">
            <h2>Why it says {data.signal}</h2>
            {data.explanation ? (
              <p>{data.explanation}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <p className="small">
              Trend: {data.bias} • ADX {data.adx14} • ATR {data.atrPips} pips • Support {data.support.toFixed(4)} • Resistance{' '}
              {data.resistance.toFixed(4)}
              {data.choppy ? ' • Market looks choppy.' : ''}
            </p>
          </div>

          <div className="box">
            <h2>Trade plan</h2>
            <div className="grid">
              <div className="cell"><div className="lab">Entry</div><b>{data.entry.toFixed(4)}</b></div>
              <div className="cell"><div className="lab">Stop loss</div><b>{data.stopLoss.toFixed(4)}</b></div>
              <div className="cell"><div className="lab">Take profit</div><b>{data.takeProfit.toFixed(4)}</b></div>
              <div className="cell"><div className="lab">Lot size</div><b>{lot ? lot.lot.toFixed(2) : '—'}</b></div>
            </div>
            <p className="small">
              Stop loss is 1.5 x ATR ({data.stopLossPips} pips). Take profit is 3.0 x ATR ({data.takeProfitPips} pips),
              about 1 to 2 risk to reward. Lot size: risk ${lot ? lot.riskDollars.toFixed(2) : '0.00'} divided by (
              {data.stopLossPips} pips x $10) = {lot ? lot.lot.toFixed(2) : '—'} lots, rounded down to 0.01.
            </p>
            <p className="small">You place the trade yourself in MT5. This app never places a trade.</p>
          </div>
        </>
      ) : (
        <div className="box">
          <h2>Check EUR/USD</h2>
          <p>Tap Refresh to check the current price and signal. Nothing is checked until you tap it.</p>
        </div>
      )}

      <div className="btnrow">
        <button className="primary" onClick={() => refresh(timeframe)} disabled={loading}>
          {loading ? 'Checking...' : 'Refresh'}
        </button>
        <Link href="/history">History</Link>
      </div>

      <div className="box">
        <h2>Settings</h2>
        <label>
          Demo balance ($)
          <input
            type="number"
            value={settings.balance}
            onChange={(e) => saveSettings({ ...settings, balance: Number(e.target.value) || 10000 })}
          />
        </label>
        <label>
          Risk per trade (%)
          <input
            type="number"
            step="0.5"
            value={settings.riskPercent}
            onChange={(e) => saveSettings({ ...settings, riskPercent: Number(e.target.value) || 1 })}
          />
        </label>
        <p className="small">Saved on this phone only. No sign up, no account.</p>
      </div>

      <footer>Educational tool, demo only. Not financial advice.</footer>
    </main>
  );
}
