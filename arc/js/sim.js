// @ts-check
// SIMULATION MODE — a synthetic engine feed so the HUD runs full-fidelity
// with zero backend: boot it, watch ARC scan/signal/veto/fill, trip the
// kill switch, browse every screen. All telemetry is fake; the store and
// screens can't tell the difference (that's the point).

import { simHydrate, applyEvent, state } from './store.js';
import * as bus from './bus.js';

const SYMS = ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'AMD', 'META', 'COIN', 'PLTR', 'MSFT'];
const STRATS = [
  { strategy_key: 'riley_signature', name: 'Riley Signature · 7-Dimension', flagship: true, thesis: "Riley's own brain: reads support/resistance, volume, order flow, candle patterns, market structure, momentum, and RSI/MACD/Bollinger across timeframes to take only high-conviction setups. Works on any stock.", tickClass: 'swing', enabled: true, mode: 'SHADOW', arbiter_weight: 1, stats: { pnl: 655.4, winRate: 0.71, trades: 14 } },
  { strategy_key: 'mean_reversion_bb', name: 'Mean Reversion · Bollinger', thesis: 'Buy panic at the lower band with RSI washed out; exit at the middle band.', tickClass: 'intraday', enabled: true, mode: 'SHADOW', arbiter_weight: 1, stats: { pnl: 412.55, winRate: 0.68, trades: 25 } },
  { strategy_key: 'momentum_breakout', name: 'Momentum Breakout', thesis: 'Buy 20-bar highs broken on ≥1.5× volume; stop under the shelf, 2R target.', tickClass: 'intraday', enabled: true, mode: 'SHADOW', arbiter_weight: 0.85, stats: { pnl: 238.1, winRate: 0.54, trades: 31 } },
  { strategy_key: 'credit_spread_theta', name: 'Credit Spread · Theta', thesis: '25-30Δ put credit spreads, 30-45 DTE, in bull/sideways regimes.', tickClass: 'scheduled', enabled: false, mode: 'SHADOW', arbiter_weight: 1, stats: { pnl: 0, winRate: 0, trades: 0 } },
  { strategy_key: 'zero_dte_momentum', name: '0DTE Momentum', thesis: 'SPY/QQQ same-day options momentum bursts; hard time-stop, flat by 15:45.', tickClass: 'fast', enabled: false, mode: 'SHADOW', arbiter_weight: 1, stats: { pnl: 0, winRate: 0, trades: 0 } },
  { strategy_key: 'crypto_momentum', name: 'Crypto Momentum · 24/7', thesis: 'Rides confirmed breakouts on major coins around the clock — buys strength on volume, ATR stop, 2R target. The one market open nights & weekends.', tickClass: 'crypto', enabled: true, mode: 'SHADOW', arbiter_weight: 1, stats: { pnl: 291.4, winRate: 0.58, trades: 19 } },
];
const CRYPTO_SYMS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'AVAX/USD', 'LINK/USD'];

// Market situations → which strategies fit. This is "the best strategy for any
// situation": Riley rotates the arsenal as conditions change. favors/standsDown
// reference strategy_keys; the read explains the match in plain language.
const REGIMES = [
  { key: 'BULL_LOW_VOL', label: 'Bull · Low Vol', vix: 13,
    favors: ['riley_signature', 'momentum_breakout'], standsDown: ['zero_dte_momentum'],
    read: "Calm uptrend, low VIX — I'm leaning into the Signature read and momentum, plus bull put spreads on pullbacks. Premium's thin, so I'm buying direction rather than selling it." },
  { key: 'RANGING_HIGH_IV', label: 'Ranging · Rich Premium', vix: 19,
    favors: ['riley_signature', 'mean_reversion_bb', 'credit_spread_theta'], standsDown: ['momentum_breakout'],
    read: "Choppy and range-bound with rich option premium — I'm selling defined-risk premium (iron condors, credit spreads) and fading extremes with mean-reversion. Breakout plays are stood down until it trends." },
  { key: 'HIGH_VOL_EVENT', label: 'High Vol · Catalyst', vix: 28,
    favors: ['zero_dte_momentum', 'riley_signature'], standsDown: ['credit_spread_theta', 'mean_reversion_bb'],
    read: "Volatility is expanding on a catalyst — I've cut size, stopped selling premium (assignment risk), and I'm playing convex structures: long strangles and fast 0DTE momentum with hard time-stops." },
  { key: 'BEAR_TREND', label: 'Bear · Downtrend', vix: 24,
    favors: ['riley_signature'], standsDown: ['momentum_breakout', 'mean_reversion_bb'],
    read: "Downtrend, lower lows — no fresh longs. I'm defensive: bear call spreads into resistance, protective collars on anything held, and mostly cash until it reclaims structure." },
];

let timers = [];
let posSeq = 100;
let evtSeq = 0;
let regimeIdx = 0;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Strategies the engine will actually fire from, given the situation + autonomy.
// Guided = only what the user enabled. Full Auto = Riley auto-uses the fitting
// arsenal (auto-enables favored strategies for the current regime).
function activeStrategies() {
  const auto = state.mandate?.autonomy || 'guided';
  const reg = state.regime;
  return (state.strategies || []).filter((s) => {
    if (!s.enabled) return false;
    if (auto === 'full') return !(reg && reg.standsDown.includes(s.strategy_key)); // rotate out unfit ones
    if (reg && reg.standsDown.includes(s.strategy_key)) return false;
    return true;
  });
}

function rotateRegime(first) {
  const reg = first ? REGIMES[0] : REGIMES[(++regimeIdx) % REGIMES.length];
  state.regime = reg;
  const auto = state.mandate?.autonomy || 'guided';
  // Re-weight strategies to the situation; in Full Auto, auto-arm the fitting ones.
  for (const s of state.strategies || []) {
    const fits = reg.favors.includes(s.strategy_key);
    const unfit = reg.standsDown.includes(s.strategy_key);
    s.arbiter_weight = unfit ? 0 : fits ? 1 : 0.5;
    if (auto === 'full' && fits && !s.flagship) s.enabled = true;
  }
  bus.emit('state', state);
  ev('regime.update', `Situation: ${reg.label} (VIX ~${reg.vix})`, { data: { regime: reg.key, vix: reg.vix } });
  const favNames = (state.strategies || []).filter((s) => reg.favors.includes(s.strategy_key)).map((s) => s.name || s.strategy_key);
  ev('arbiter.read', `${auto === 'full' ? 'Full Auto' : 'Guided'} — ${reg.read}`, { data: { regime: reg.key, favors: favNames, autonomy: auto } });
}

function ev(type, summary, { severity = 'info', strategyKey = null, symbol = null, data = {} } = {}) {
  applyEvent({ id: ++evtSeq, ts: new Date().toISOString(), type, severity, strategyKey, symbol, summary, data });
}

const CRYPTO_PX = { 'BTC/USD': 61000, 'ETH/USD': 3400, 'SOL/USD': 165, 'AVAX/USD': 38, 'LINK/USD': 18 };
function mkPosition(strategyKey, symbol) {
  const base = CRYPTO_PX[symbol] || rnd(80, 480);
  const entry = +(base * (CRYPTO_PX[symbol] ? rnd(0.99, 1.01) : 1)).toFixed(2);
  const stop = +(entry * rnd(0.985, 0.995)).toFixed(2);
  const target = +(entry * rnd(1.01, 1.025)).toFixed(2);
  return {
    id: ++posSeq, strategy_key: strategyKey, mode: 'SHADOW', symbol, occ_symbol: null,
    instrument_type: CRYPTO_PX[symbol] ? 'crypto' : 'equity', direction: 'long',
    quantity: CRYPTO_PX[symbol] ? +(100 / (entry - stop)).toFixed(4) : Math.max(1, Math.floor(100 / (entry - stop))),
    entry_price: entry, entry_at: new Date().toISOString(),
    stop_loss: stop, target, status: 'open', max_loss_usd: 100,
    thesis: `${symbol} simulated setup — synthetic conviction, real aesthetics.`,
  };
}

function mkOptionPosition(strategyKey, symbol, kind) {
  const strike = Math.round(rnd(90, 480) / 5) * 5;
  const exp = new Date(); exp.setDate(exp.getDate() + (kind === '0dte' ? 0 : 21));
  const yy = String(exp.getFullYear()).slice(2), mm = String(exp.getMonth() + 1).padStart(2, '0'), dd = String(exp.getDate()).padStart(2, '0');
  const cp = Math.random() < 0.5 ? 'C' : 'P';
  const occ = `${symbol}${yy}${mm}${dd}${cp}${String(strike * 1000).padStart(8, '0')}`;
  const premium = +rnd(0.8, 4.5).toFixed(2);
  return {
    id: ++posSeq, strategy_key: strategyKey, mode: 'SHADOW', symbol, occ_symbol: occ,
    instrument_type: 'option', direction: 'long',
    quantity: Math.max(1, Math.floor(100 / (premium * 100) * 3)),
    entry_price: premium, entry_at: new Date().toISOString(),
    stop_loss: +(premium * 0.6).toFixed(2), target: +(premium * 1.8).toFixed(2),
    status: 'open', max_loss_usd: 100,
    thesis: `${symbol} ${cp === 'C' ? 'call' : 'put'} — ${kind === '0dte' ? '0DTE momentum' : 'directional swing'} play.`,
  };
}

function seedEquityDay() {
  // A plausible intraday equity curve for the sparkline.
  const pts = [];
  let v = 25000;
  for (let i = 0; i < 78; i++) { v += rnd(-40, 48); pts.push(+v.toFixed(2)); }
  return pts;
}

export function startSim() {
  const positions = [mkPosition('mean_reversion_bb', 'NVDA'), mkPosition('riley_signature', 'SPY'), mkOptionPosition('riley_signature', 'AAPL', 'swing'), mkOptionPosition('zero_dte_momentum', 'SPY', '0dte')];
  // Overview v2 groups positions by book — tag the fixtures like the backend does.
  positions.forEach((p) => { p.book = p.strategy_key === 'zero_dte_momentum' ? 'book' : 'account'; });
  simHydrate({
    engine: { state: 'RUNNING', state_reason: null, risk_config: { liveTradingEnabled: false, maxPerTradeUsd: 100, maxDailyLossUsd: 300, maxOpenPositions: 5, maxNotionalPerTradeUsd: 2000, maxExposurePct: 40, pdtProtection: true, cooldownLosses: 3, cooldownMinutes: 90, econBlackoutMinutes: 15, smallAccountStrategies: ['zero_dte_momentum'] }, trading_account_id: 'SIM-ALPACA-PAPER' },
    market: { status: 'open', message: 'Market open (simulation)' },
    balance: { cash: 25412.88, buyingPower: 25412.88 },
    equity: 25412.88,
    todayPnl: 184.62,
    unrealized: 63.4,
    hero: { equity: 25412.88, dayChangeUsd: 212.4, dayChangePct: 0.84, bookEquity: 1038.2, bookValue: 1061.7, bookDayChangeUsd: 41.3, bookDayChangePct: 4.05 },
    today: {
      wins: 5, losses: 3, realizedPnl: 184.62,
      book: { wins: 2, losses: 1, realizedPnl: 38.2 },
      account: { wins: 3, losses: 2, realizedPnl: 146.42 },
      byStrategy: [
        { strategy_key: 'zero_dte_momentum', trades: 3, wins: 2, losses: 1, pnl: 38.2, book: 'book' },
        { strategy_key: 'scalp_equity', trades: 3, wins: 2, losses: 1, pnl: 82.1, book: 'account' },
        { strategy_key: 'riley_signature', trades: 2, wins: 1, losses: 1, pnl: 64.3, book: 'account' },
      ],
    },
    positions,
    strategies: STRATS.map((s) => ({ ...s })),
    events: [],
    marks: {},
    record: { wins: 47, losses: 21, closedPnl: 1306.05 },
    mandate: { goal: 'Grow the account steadily with options income — aim for ~$400/week', autonomy: 'guided', riskAppetite: 'balanced' },
    permissions: { stocks: true, options: true, crypto: true, zerodte: false, optionLevel: 2, marketWide: false },
    watchlist: ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL', 'BTC/USD', 'ETH/USD'],
    connection: { connected: true, brokerageName: 'Alpaca Paper (SIM)', lastSyncAt: new Date().toISOString() },
    equityCurve: seedEquityDay(),
  });

  ev('engine.start', 'ARC engine online — simulation telemetry active', { data: { sim: true } });
  rotateRegime(true); // set the opening situation + fit strategies to it

  bus.emit('link', 'linked');

  // Situation changes — Riley rotates strategies to fit the new regime.
  timers.push(setInterval(() => rotateRegime(false), 34000));

  // Universe Riley scans: your watchlist in Guided, market-wide in Full Auto.
  const universe = () => (state.mandate?.autonomy === 'full' || state.permissions?.marketWide)
    ? SYMS.concat(['AMZN', 'GOOG', 'NFLX', 'AVGO', 'CRM', 'UBER', 'SHOP', 'MU'])
    : (state.watchlist && state.watchlist.length ? state.watchlist : SYMS);

  // Ambient scans
  timers.push(setInterval(() => {
    const act = activeStrategies(); if (!act.length) return;
    const s = pick(act);
    const sym = pick(universe());
    ev('strategy.scan', `${sym}: no setup (px ${rnd(90, 470).toFixed(2)}, RSI ${rnd(35, 65).toFixed(0)}, vol×${rnd(0.6, 1.4).toFixed(1)})`, { severity: 'debug', strategyKey: s.strategy_key, symbol: sym });
  }, 2600));

  // Marks on open positions
  timers.push(setInterval(() => {
    const marks = state.positions.map((p) => {
      const drift = rnd(-0.35, 0.45);
      const mark = +(Number(p.entry_price) * (1 + drift / 100)).toFixed(2);
      return { positionId: p.id, symbol: p.symbol, mark, pnl: +((mark - p.entry_price) * p.quantity).toFixed(2) };
    });
    const unrealized = +marks.reduce((s, m) => s + m.pnl, 0).toFixed(2);
    ev('position.mark', `Marked ${marks.length} open position(s), unrealized ${unrealized >= 0 ? '+' : ''}$${unrealized}`, { severity: 'debug', data: { marks, unrealized } });
  }, 1800));

  // Signal → gates → fill / veto drama
  timers.push(setInterval(() => {
    const act = activeStrategies(); if (!act.length) return;
    const s = pick(act);
    const sym = s.strategy_key === 'crypto_momentum' ? pick(CRYPTO_SYMS) : pick(universe());
    const conf = +rnd(0.55, 0.9).toFixed(2);
    ev('signal.new', `${s.strategy_key} spotted ${sym} long (confidence ${conf})`, { strategyKey: s.strategy_key, symbol: sym, data: { confidence: conf } });
    setTimeout(() => {
      if (Math.random() < 0.45) {
        const gate = pick(['per_trade_cap', 'position_count', 'exposure', 'daily_loss', 'buying_power', 'one_per_underlying']);
        ev('signal.rejected', `${sym} long vetoed at ${gate}`, { severity: 'warn', strategyKey: s.strategy_key, symbol: sym, data: { stage: 'risk', gate, gates: [{ name: gate, pass: false, value: 'sim', limit: 'sim' }] } });
      } else if (state.positions.length >= 5) {
        ev('signal.rejected', `${sym} long vetoed at position_count`, { severity: 'warn', strategyKey: s.strategy_key, symbol: sym, data: { stage: 'risk', gate: 'position_count' } });
      } else {
        ev('signal.accepted', `${sym} long approved — all 13 gates green`, { strategyKey: s.strategy_key, symbol: sym, data: { confidence: conf, gates: [{ name: 'all', pass: true }] } });
        const p = mkPosition(s.strategy_key, sym);
        setTimeout(() => {
          ev('order.submitting', `SHADOW BUY ${p.quantity} ${sym} @ Market — submitting`, { strategyKey: s.strategy_key, symbol: sym });
          ev('order.filled', `SHADOW filled BUY ${p.quantity} ${sym} @ $${p.entry_price}`, { strategyKey: s.strategy_key, symbol: sym, data: { fillPrice: p.entry_price } });
          state.positions.push(p);
          ev('position.opened', `SHADOW position opened: LONG ${p.quantity} ${sym} @ $${p.entry_price} · stop $${p.stop_loss} · target $${p.target}`, { strategyKey: s.strategy_key, symbol: sym, data: { positionId: p.id, entry: p.entry_price, thesis: p.thesis } });
          bus.emit('state', state);
        }, rnd(600, 1400));
      }
    }, rnd(500, 1200));
  }, 9000));

  // Occasional position closes
  timers.push(setInterval(() => {
    if (state.positions.length <= 1) return;
    const p = pick(state.positions);
    const win = Math.random() < 0.62;
    const exit = +(Number(p.entry_price) * (win ? rnd(1.004, 1.018) : rnd(0.988, 0.998))).toFixed(2);
    const pnl = +((exit - p.entry_price) * p.quantity).toFixed(2);
    ev('position.closed', `SHADOW closed LONG ${p.quantity} ${p.symbol} @ $${exit} → ${pnl >= 0 ? '+' : ''}$${pnl} (${win ? 'target' : 'stop'})`, { severity: win ? 'info' : 'warn', strategyKey: p.strategy_key, symbol: p.symbol, data: { positionId: p.id, pnl, reason: win ? 'target' : 'stop' } });
  }, 23000));

  // AI musings
  timers.push(setInterval(() => {
    const sym = pick(SYMS);
    ev('ai.analysis', `Riley reads ${sym}: ${pick(['SKIP — chop, no edge', `LONG (conf ${rnd(0.66, 0.85).toFixed(2)}) — coiled above VWAP with sector tailwind`, 'SKIP — earnings in 2 days, stand aside'])}`, { strategyKey: 'riley_signature', symbol: sym });
  }, 17000));
}

export function stopSim() {
  timers.forEach(clearInterval);
  timers = [];
}

/** Simulated kill switch so the red-alert theme demos end-to-end. */
export function simKill(level, reason) {
  ev('kill.activated', `KILL SWITCH L${level} — ${reason || 'manual'} (hud)`, { severity: 'critical', data: { level, reason } });
  if (level >= 2) ev('order.canceled', 'Canceled 0 working orders (simulation)', { data: {} });
  if (level >= 3) {
    for (const p of [...state.positions]) {
      ev('position.closed', `SHADOW closed LONG ${p.quantity} ${p.symbol} @ $${p.entry_price} → $0.00 (flatten)`, { strategyKey: p.strategy_key, symbol: p.symbol, data: { positionId: p.id, pnl: 0, reason: 'flatten' } });
    }
  }
  bus.emit('state', state);
}

export function simResume() {
  ev('kill.resumed', 'Engine resumed by hud', {});
  bus.emit('state', state);
}
