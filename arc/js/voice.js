// @ts-check
// Statusline — terminal telemetry, no persona. One compact readout in the
// status bar; refreshes on state changes and periodically. Institutional:
// facts only, no first person.

import * as bus from './bus.js';
import { state, thoughtRate } from './store.js';
import { money } from './components/fmt.js';

const el = () => document.getElementById('voice-line');

function line() {
  const s = state.engine?.state || 'OFF';
  if (s === 'OFF') return 'ENGINE OFFLINE · awaiting start';
  if (s === 'HALTED_MANUAL') return 'HALTED (manual) · protective exits active';
  if (s === 'HALTED_RISK') return 'HALTED (risk) · daily limit — no new entries';

  const active = state.strategies.filter((x) => x.enabled).length;
  const open = state.positions.length;
  const rate = thoughtRate();
  // canTrade is the truth; the old status!=='open' check never matched the real
  // RTH value ('market_hours') and showed MKT CLOSED all day. Crypto trades
  // around the clock, so a closed equity market still reads SCANNING · 24/7.
  const equitiesClosed = state.market ? state.market.canTrade !== true : false;
  const today = state.hero?.dayChangeUsd;
  return [
    equitiesClosed ? 'SCANNING · CRYPTO 24/7' : 'MKT OPEN · SCANNING',
    `${active} STRAT`,
    `${open} OPEN`,
    `${rate}/min`,
    today != null ? `TODAY ${money(today, { sign: true, dp: 0 })}` : '',
  ].filter(Boolean).join('  ·  ');
}

export function speak() {
  const node = el();
  if (node) node.textContent = line();
}

export function init() {
  bus.on('state', speak);
  bus.on('alert', speak);
  bus.on('evt', (e) => { if (/^(engine|kill|position|signal)/.test(e.type)) speak(); });
  setInterval(speak, 5000);
  speak();
}
