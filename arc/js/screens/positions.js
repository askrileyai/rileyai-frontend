// @ts-check
// POSITIONS — open engine positions with live marks, exit flows, recent orders.

import * as bus from '../bus.js';
import { state } from '../store.js';
import { api, isSim } from '../api.js';
import { money, pnlClass, esc } from '../components/fmt.js';

let unsubs = [];
let orders = [];

export function mount(host) {
  host.innerHTML = `
    <div class="positions">
      <h1>Positions</h1>
      <div class="holo">
        <div class="holo-label">Open — Engine-Owned</div>
        <table class="dtable hide-mobile">
          <thead><tr><th>Symbol</th><th>Strategy</th><th>Dir</th><th>Qty</th><th>Entry</th><th>Mark</th><th>Stop / Target</th><th>P&L</th><th></th></tr></thead>
          <tbody id="p-body"></tbody>
        </table>
        <div class="pos-mobile" id="p-mobile"></div>
        <div class="empty-note" id="p-empty" hidden>No open positions.</div>
      </div>
      <div class="holo">
        <div class="holo-label">Recent Orders</div>
        <table class="dtable">
          <thead><tr><th>Time</th><th>Intent</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Status</th><th>Fill</th></tr></thead>
          <tbody id="o-body"></tbody>
        </table>
        <div class="empty-note" id="o-empty" hidden>No orders yet.</div>
      </div>
    </div>
  `;
  paint();
  loadOrders();
  unsubs = [
    bus.on('state', paint),
    bus.on('evt', (evt) => {
      if (evt.type === 'position.mark') paint();
      if (/^order\./.test(evt.type)) loadOrders();
      if (/^position\./.test(evt.type)) paint();
    }),
  ];
}

export function unmount() { unsubs.forEach((u) => u()); unsubs = []; }

function paint() {
  const body = document.getElementById('p-body');
  const mob = document.getElementById('p-mobile');
  const empty = document.getElementById('p-empty');
  if (!body) return;
  empty.hidden = state.positions.length > 0;

  body.innerHTML = state.positions.map((p) => {
    const m = state.marks[p.id] || {};
    return `<tr>
      <td><b>${esc(p.symbol)}</b>${p.occ_symbol ? `<div class="faint" style="font-size:.65rem">${esc(p.occ_symbol)}</div>` : ''}</td>
      <td class="dim">${esc(p.strategy_key)}</td>
      <td>${esc(p.direction).toUpperCase()}</td>
      <td>${p.quantity}</td>
      <td>${money(p.entry_price)}</td>
      <td>${m.mark != null ? money(m.mark) : '—'}</td>
      <td class="dim">${p.stop_loss ? money(p.stop_loss) : '—'} / ${p.target ? money(p.target) : '—'}</td>
      <td class="${pnlClass(m.pnl)}">${m.pnl != null ? money(m.pnl, { sign: true }) : '—'}</td>
      <td><button class="btn ghost" style="min-height:32px;padding:2px 12px;font-size:.6rem" data-exit="${p.id}">EXIT</button></td>
    </tr>`;
  }).join('');

  mob.innerHTML = state.positions.map((p) => {
    const m = state.marks[p.id] || {};
    return `<div class="holo pm-card">
      <div class="pm-top"><b class="display" style="font-size:.95rem">${esc(p.symbol)}</b><span class="${pnlClass(m.pnl)} mono">${m.pnl != null ? money(m.pnl, { sign: true }) : '—'}</span></div>
      <div class="pm-detail"><span>${esc(p.direction).toUpperCase()} ${p.quantity} @ ${money(p.entry_price)}</span><span>mark ${m.mark != null ? money(m.mark) : '—'}</span></div>
      <div class="pm-detail"><span class="faint">${esc(p.strategy_key)}</span><span class="faint">stop ${p.stop_loss ? money(p.stop_loss) : '—'} · tgt ${p.target ? money(p.target) : '—'}</span></div>
      <button class="btn ghost" style="min-height:38px;font-size:.62rem" data-exit="${p.id}">EXIT POSITION</button>
    </div>`;
  }).join('');

  document.querySelectorAll('[data-exit]').forEach((b) => {
    b.addEventListener('click', () => exitPosition(Number(b.getAttribute('data-exit'))));
  });
}

async function exitPosition(id) {
  const p = state.positions.find((x) => x.id === id);
  if (!p) return;
  if (!window.confirm(`Flatten ${p.quantity} ${p.symbol} at market?`)) return;
  if (isSim()) {
    const { simKill } = await import('../sim.js'); // reuse close mechanics
    const { applyEvent } = await import('../store.js');
    applyEvent({ ts: new Date().toISOString(), type: 'position.closed', severity: 'info', strategyKey: p.strategy_key, symbol: p.symbol, summary: `SHADOW closed LONG ${p.quantity} ${p.symbol} @ ${money(p.entry_price)} → $0.00 (manual)`, data: { positionId: p.id, pnl: 0, reason: 'manual' } });
    bus.emit('state', state);
    return;
  }
  try { await api.exitPosition(id); } catch (e) { alert(`Exit failed: ${e.message}`); }
}

async function loadOrders() {
  const body = document.getElementById('o-body');
  const empty = document.getElementById('o-empty');
  if (!body) return;
  if (isSim()) {
    // derive from events in sim
    orders = state.events.filter((e) => /^order\.(filled|canceled|submitting)/.test(e.type)).slice(-15).reverse()
      .map((e) => ({ created_at: e.ts, intent: 'entry', symbol: e.symbol, side: /BUY/.test(e.summary) ? 'buy' : 'sell', quantity: '', status: e.type.replace('order.', ''), fill_price: e.data?.fillPrice }));
  } else {
    try { orders = (await api.orders(25)).orders || []; } catch (_) { orders = []; }
  }
  empty.hidden = orders.length > 0;
  body.innerHTML = orders.map((o) => `<tr>
    <td class="faint">${new Date(o.created_at).toLocaleTimeString('en-US', { hour12: false })}</td>
    <td>${esc(o.intent || '')}</td>
    <td><b>${esc(o.symbol || '')}</b></td>
    <td>${esc(o.side || '')}</td>
    <td>${o.quantity || ''}</td>
    <td class="${/filled/.test(o.status) ? 'gain' : /reject|unknown|cancel/.test(o.status) ? 'loss' : 'dim'}">${esc(o.status)}</td>
    <td>${o.fill_price ? money(o.fill_price) : '—'}</td>
  </tr>`).join('');
}
