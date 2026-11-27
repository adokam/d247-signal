# D247 Signal

Simple EUR/USD signal check. Manual, on demand, demo only.

Open the app, tap Refresh, read the signal, then place the trade yourself in MT5 if you agree. This app never places a trade and never runs 24 hours by itself.

## What it does

- Dashboard: EUR/USD live price, H1 / H4 switcher, big BUY / SELL / WAIT card.
- Score 0 to 100, labelled Low / Medium / Strong. The score is capped at 85.
  It is not a true probability and it never claims a 90 percent chance.
  The page says: Not a promise, this setup can still lose.
- Reasons in plain English from rules: trend (EMA 20 vs EMA 50), structure
  (recent support and resistance), volatility (ATR 14) and a choppy-market
  filter (ADX 14). When the market is choppy the score is capped and the
  signal is WAIT.
- Trade plan: entry is the current price, stop loss is 1.5 x ATR, take profit
  is 3.0 x ATR, about 1 to 2 risk to reward. Lot size comes from your demo
  balance and risk percent, saved on your phone only.
- History page: every signal shown is saved on your phone. Later it is
  checked against fresh candles and marked WON if take profit was hit first,
  LOST if stop loss was hit first, OPEN if neither was hit yet.
- PWA: you can install it from Android Chrome, Add to Home screen.
  The app shell works offline, but price data is never cached and always
  comes fresh from the API when you are online.

## No sign up

There is no account, no login and no sign up. Just open the link.

## Setup on Vercel

1. Import this repo in Vercel: New Project, pick `d247-signal`.
2. In Vercel, go to Settings, Environment Variables, and add:
   - `TWELVE_DATA_API_KEY` = your free Twelve Data key
   - `GROQ_API_KEY` = your free Groq key (optional, the app still works
     without it and falls back to the rule-based reasons)
3. Deploy. Open the link on your phone and use Add to Home screen in Chrome
   to install it as an app.

Get a free Twelve Data key at twelvedata.com. Get a free Groq key at
console.groq.com. Never put a real key in the code or in `.env.example`.

## Run locally

```bash
npm install
cp .env.example .env.local
# fill in TWELVE_DATA_API_KEY and GROQ_API_KEY in .env.local
npm run dev
```

## Note

Educational tool, demo only. Not financial advice. Test on a demo account
for 1 to 2 months before you think about real money.
