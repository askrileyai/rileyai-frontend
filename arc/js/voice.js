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
  const day = Number(state.todayPnl || 0) + Number(state.unrealized || 0);
  const rate = thoughtRate();
  const closed = state.market?.status && state.market.status !== 'open';
  return [
    closed ? 'MKT CLOSED' : 'SCANNING',
    `${active} STRAT`,
    `${open} OPEN`,
    `${rate}/min`,
    `SESSION ${money(day, { sign: true, dp: 0 })}`,
  ].join('  ·  ');
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
