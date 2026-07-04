// @ts-check
// Shared analysis engine — Riley's read of any symbol and a generator of
// hedge-fund-grade trade ideas. Sim produces a deterministic, plausible read;
// real mode will call the backend 7-dimension pipeline (build7DimensionPrompt).

import { money } from './components/fmt.js';

/** Riley's live read of a symbol: price action, levels, vol, momentum, bias. */
export function readFor(sym) {
  const seed = [...sym].reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (n) => ((Math.sin(seed * (n + 1)) + 1) / 2);
  const price = +(40 + r(1) * 440).toFixed(2);
  const chgPct = +((r(2) - 0.45) * 4).toFixed(2);
  const chg = +(price * chgPct / 100).toFixed(2);
  const rsi = Math.round(28 + r(3) * 48);
  const volX = +(0.6 + r(4) * 1.8).toFixed(1);
  const ivRank = Math.round(r(7) * 100);            // implied-vol percentile
  const support = +(price * (0.97 - r(5) * 0.02)).toFixed(2);
  const resistance = +(price * (1.02 + r(6) * 0.02)).toFixed(2);
  const nearSupport = (price - support) / price < 0.012;
  const nearResist = (resistance - price) / price < 0.012;
  const bull = chgPct > 0 && rsi < 68;
  const biasLabel = bull ? 'Bullish' : chgPct < -0.5 ? 'Bearish' : 'Neutral';
  const biasCls = bull ? 'up' : chgPct < -0.5 ? 'down' : 'off';
  const trend = bull ? 'uptrend' : chgPct < -0.5 ? 'downtrend' : 'ranging';
  const mom = rsi > 60 ? 'strong' : rsi < 40 ? 'weak' : 'neutral';
  const struct = bull ? 'higher highs' : chgPct < -0.5 ? 'lower lows' : 'inside range';
  const say = `${sym} is ${chgPct >= 0 ? 'up' : 'down'} ${Math.abs(chgPct).toFixed(1)}% at ${money(price)}, ${trend} on ${volX}× average volume. RSI ${rsi} (${mom}), IV rank ${ivRank}. Price is ${nearSupport ? `sitting on support ${money(support)}` : nearResist ? `pressing resistance ${money(resistance)}` : `mid-range between ${money(support)} and ${money(resistance)}`}.`;
  const play = bull
    ? (nearResist ? `Wait for a break and retest of ${money(resistance)}, then go long with a stop under ${money(support)}.` : `Long on a pullback toward ${money(support)}; target ${money(resistance)}, stop below it.`)
    : chgPct < -0.5
      ? `Stand aside or fade strength into ${money(resistance)}; no long until it reclaims ${money(resistance)}.`
      : `No edge yet — wait for a decisive break of ${money(support)} or ${money(resistance)}.`;
  const optionPlay = bull ? `a ${Math.round(price / 5) * 5 + 5} call, 2-3 weeks out, sized to $100 risk` : chgPct < -0.5 ? `a ${Math.round(price / 5) * 5 - 5} put if it loses ${money(support)}` : `wait — buy premium only on a confirmed break`;
  return { sym, price, chg, chgPct, rsi, volX, ivRank, support, resistance, nearSupport, nearResist, biasLabel, biasCls, trend, mom, struct, say, play, optionPlay };
}

const rr = (a, b) => `${a.toFixed(0)}:${b.toFixed(0)}`;

/**
 * Map a read to the RIGHT hedge-fund structure — institutional playbook, not
 * just "buy calls". Returns {symbol, name, type, thesis, structure, riskReward,
 * conviction, tag}.
 */
export function ideaFor(read) {
  const p = read.price, s = read.support, r = read.resistance, sym = read.sym;
  const w5 = (x) => Math.round(x / 5) * 5;              // round to $5 strike
  // High IV + range-bound → sell premium both sides (income).
  if (read.ivRank >= 55 && read.biasLabel === 'Neutral') {
    return { symbol: sym, name: 'Iron Condor', type: 'options', tag: 'Range income',
      thesis: `${sym} is ranging with rich premium (IV rank ${read.ivRank}). Sell both sides and collect theta while it chops between ${money(s)} and ${money(r)}.`,
      structure: `Sell ${w5(r)} call / buy ${w5(r) + 10} call, sell ${w5(s)} put / buy ${w5(s) - 10} put, ~30-40 DTE. Defined risk.`,
      riskReward: 'Collect ~35% of width; profit if it stays in range', conviction: 0.72 + read.ivRank / 500 };
  }
  // Bullish + pullback to support → bull put spread (defined-risk income).
  if (read.biasLabel === 'Bullish' && (read.nearSupport || read.rsi < 45)) {
    return { symbol: sym, name: 'Bull Put Spread', type: 'options', tag: 'Defined-risk bullish',
      thesis: `${sym} is holding an uptrend and pulling into support ${money(s)}. Sell the put spread below support — get paid to be bullish with capped risk.`,
      structure: `Sell ${w5(s)} put / buy ${w5(s) - 10} put, ~30 DTE. Max loss = width − credit.`,
      riskReward: rr(1, 2) + ' typical, high win-rate', conviction: 0.78 };
  }
  // Bullish + momentum breakout → call debit spread.
  if (read.biasLabel === 'Bullish' && read.mom === 'strong') {
    return { symbol: sym, name: 'Call Debit Spread', type: 'options', tag: 'Directional',
      thesis: `${sym} has strong momentum (RSI ${read.rsi}) breaking structure. Capped-cost bullish exposure toward ${money(r)}.`,
      structure: `Buy ${w5(p)} call / sell ${w5(r)} call, 2-4 weeks. Cheaper than long calls, defined risk.`,
      riskReward: rr(1, 2.5), conviction: 0.74 };
  }
  // Overbought → call credit spread (fade), or oversold → same bull put above handled.
  if (read.rsi > 70) {
    return { symbol: sym, name: 'Bear Call Spread', type: 'options', tag: 'Mean-reversion fade',
      thesis: `${sym} is overbought (RSI ${read.rsi}) into resistance ${money(r)}. Fade the extension with a defined-risk credit spread above.`,
      structure: `Sell ${w5(r)} call / buy ${w5(r) + 10} call, ~21-30 DTE.`,
      riskReward: 'High win-rate, capped risk', conviction: 0.68 };
  }
  // Big vol / event-like (high volX) → long strangle (volatility).
  if (read.volX >= 1.6) {
    return { symbol: sym, name: 'Long Strangle', type: 'options', tag: 'Volatility',
      thesis: `${sym} is moving on ${read.volX}× volume — a catalyst is in play. Own both directions for the expansion; size small.`,
      structure: `Buy ${w5(r)} call + ${w5(s)} put, near-dated. Profits on a big move either way.`,
      riskReward: 'Convex; small defined debit', conviction: 0.62 };
  }
  // Bearish → protective/stand-aside or bear structure.
  if (read.biasLabel === 'Bearish') {
    return { symbol: sym, name: 'Protective Put / Stand Aside', type: 'options', tag: 'Defensive',
      thesis: `${sym} is in a downtrend (lower lows). No long here. If you hold shares, collar them; otherwise wait for a reclaim of ${money(r)}.`,
      structure: `Hold: buy ${w5(s)} put as insurance, finance with a ${w5(r)} covered call (a collar).`,
      riskReward: 'Caps downside', conviction: 0.55 };
  }
  // Default: the wheel (systematic income on quality names).
  return { symbol: sym, name: 'The Wheel', type: 'options', tag: 'Systematic income',
    thesis: `${sym} is a quality name to run the wheel on — sell cash-secured puts at support, take assignment, then sell covered calls. Steady income.`,
    structure: `Sell ${w5(s)} cash-secured put, ~30 DTE; if assigned, sell ${w5(r)} covered calls.`,
    riskReward: 'Income-first, defined by strike', conviction: 0.6 };
}

/** Top N hedge-fund ideas across the watchlist, ranked by conviction. */
export function bestIdeas(symbols, n = 4) {
  return (symbols || []).map((s) => ideaFor(readFor(s)))
    .sort((a, b) => b.conviction - a.conviction)
    .slice(0, n);
}
