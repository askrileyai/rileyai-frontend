// @ts-check
// Store — single source of truth for the HUD. Holds the engine snapshot, the
// 500-event ring buffer, live position marks, and the thought-rate window.
// Screens are dumb subscribers: they read state and re-render on bus events.

import * as bus from './bus.js';
import { api, isSim } from './api.js';

export const state = {
  engine: { state: 'OFF', state_reason: null, risk_config: {}, trading_account_id: null },
  market: { status: 'unknown', message: '' },
  balance: null,               // {cash, buyingPower}
  equity: null,
  todayPnl: 0,
  unrealized: 0,
  ledger: null,
  positions: [],               // open arc positions
  strategies: [],              // merged registry + config
  events: [],                  // ring buffer (max 500)
  marks: {},                   // positionId -> {mark, pnl}
  eventTimes: [],              // timestamps for thought-rate
  connection: null,
  record: { wins: 0, losses: 0, closedPnl: 0 }, // lifetime-ish track record
  // Riley's mandate: the plain-language goal + how autonomous + how much risk.
  mandate: { goal: null, autonomy: 'guided', riskAppetite: 'balanced' },
  // What Riley is allowed to trade.
  permissions: { stocks: true, options: true, crypto: false, zerodte: false, optionLevel: 2, marketWide: false },
  watchlist: ['SPY', 'QQQ', 'NVDA', 'TSLA', 'AAPL'],
  regime: null,                // current market situation {key,label,vix,favors,standsDown,read}
  simulated: isSim(),
};

// Risk-appetite presets → the raw risk_config numbers (so users pick a vibe,
// not fiddle with dollar caps). Applied when appetite changes.
export const RISK_PRESETS = {
  conservative: { maxPerTradeUsd: 50, maxDailyLossUsd: 150, maxOpenPositions: 3, maxExposurePct: 25 },
  balanced:     { maxPerTradeUsd: 100, maxDailyLossUsd: 300, maxOpenPositions: 5, maxExposurePct: 40 },
  aggressive:   { maxPerTradeUsd: 250, maxDailyLossUsd: 750, maxOpenPositions: 8, maxExposurePct: 60 },
};

const RING = 500;

/** Live track-record helpers — everything connected. */
export function winRate() {
  const n = state.record.wins + state.record.losses;
  return n ? state.record.wins / n : null;
}
export function openPnl() {
  return state.positions.reduce((s, p) => s + (state.marks[p.id]?.pnl || 0), 0);
}

export function alertMode() {
  const s = state.engine?.state || 'OFF';
  if (s === 'HALTED_RISK' || s === 'HALTED_MANUAL') return 'halted';
  const anyLive = state.strategies.some((x) => x.enabled && x.mode === 'LIVE') && state.engine?.risk_config?.liveTradingEnabled;
  if (s === 'RUNNING' && !anyLive) return 'shadow';
  return 'none';
}

export function applyAlertTheme() {
  document.documentElement.setAttribute('data-alert', alertMode());
  bus.emit('alert', alertMode());
}

/** Ingest one decision event (from SSE, replay, or the simulator). */
export function applyEvent(evt) {
  state.events.push(evt);
  if (state.events.length > RING) state.events.shift();
  state.eventTimes.push(Date.now());
  while (state.eventTimes.length && state.eventTimes[0] < Date.now() - 60000) state.eventTimes.shift();

  // State-bearing events update the snapshot without a refetch.
  const d = evt.data || {};
  switch (evt.type) {
    case 'engine.state':
      if (d.toState) state.engine.state = d.toState;
      if (d.reason !== undefined) state.engine.state_reason = d.reason;
      applyAlertTheme();
      break;
    case 'kill.activated':
      state.engine.state = 'HALTED_MANUAL';
      applyAlertTheme();
      break;
    case 'kill.resumed':
      state.engine.state = 'RUNNING';
      applyAlertTheme();
      break;
    case 'position.mark':
      if (Array.isArray(d.marks)) {
        for (const m of d.marks) state.marks[m.positionId] = m;
        state.unrealized = Number(d.unrealized) || 0;
      }
      break;
    case 'position.opened':
      refreshPositions();
      break;
    case 'position.closed':
      state.positions = state.positions.filter((p) => p.id !== d.positionId);
      delete state.marks[d.positionId];
      if (typeof d.pnl === 'number') {
        state.todayPnl += d.pnl;
        state.record.closedPnl += d.pnl;
        if (d.pnl > 0) state.record.wins++; else if (d.pnl < 0) state.record.losses++;
      }
      break;
    case 'arbiter.update':
      if (d.weights) {
        for (const s of state.strategies) {
          if (d.weights[s.strategy_key]) s.arbiter_weight = d.weights[s.strategy_key].weight;
        }
      }
      break;
    default:
      break;
  }
  bus.emit('evt', evt);
}

export function thoughtRate() {
  return state.eventTimes.length; // events in the last 60s
}

let refreshingPos = false;
export async function refreshPositions() {
  if (state.simulated || refreshingPos) return;
  refreshingPos = true;
  try {
    const r = await api.positions('open');
    state.positions = r.positions || [];
    bus.emit('state', state);
  } catch (_) {} finally { refreshingPos = false; }
}

/** Full snapshot pull — gate success, tab-return, reconnect. */
export async function hydrate() {
  if (state.simulated) return; // simulator owns the state
  const [status, strategies] = await Promise.all([api.status(), api.strategies()]);
  Object.assign(state, {
    engine: status.engine || state.engine,
    mandate: status.mandate || state.mandate,
    permissions: status.permissions || state.permissions,
    market: status.market || state.market,
    balance: status.balance || null,
    equity: status.equity ?? null,
    todayPnl: Number(status.todayPnl) || 0,
    unrealized: Number(status.unrealized) || 0,
    ledger: status.ledger || null,
    positions: status.positions || [],
    record: status.record || state.record,
    regime: status.regime || null,
    connection: status.connection || null,
  });
  // Seed live marks from the snapshot so P&L shows before the first SSE tick.
  state.marks = {};
  for (const p of state.positions) if (p.mark != null) state.marks[p.id] = { positionId: p.id, symbol: p.symbol, mark: p.mark, pnl: p.pnl };
  state.strategies = strategies.strategies || [];
  applyAlertTheme();
  bus.emit('state', state);
}

/** Replace whole state from the simulator. */
export function simHydrate(snapshot) {
  Object.assign(state, snapshot, { simulated: true });
  applyAlertTheme();
  bus.emit('state', state);
}
