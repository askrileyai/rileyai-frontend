// @ts-check
// POSITIONS — open engine positions with live marks, exit flows, recent orders.

import * as bus from '../bus.js';
import { state } from '../store.js';
import { api, isSim } from '../api.js';
import { money, pnlClass, esc } from '../components/fmt.js';

let unsubs = [];
let orders = [];

// OCC option symbol → human-readable contract: "SPY260707C00620000" →
// { type:'CALL', strike:620, exp:'Jul 7', dte:0 }. Options positions must be
// unmistakable: strike + expiration, never a raw OCC blob. (Exported — the
// Overview's position groups render the same badges.)
export function parseOcc(occ) {
  const m = /^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(String(occ || '').toUpperCase());
  if (!m) return null;
  const exp = new Date(Date.UTC(2000 + +m[2], +m[3] - 1, +m[4]));
  const dte = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  return {
    type: m[5] === 'C' ? 'CALL' : 'PUT',
    strike: +m[6] / 1000,
    expLabel: exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    dte: Math.max(0, dte),
  };
}

// Max drawdown (max adverse excursion) — the worst the position has been
// against us since entry, from the persisted trough/peak marks. True risk
// data, not just the current P&L snapshot.
function maxDD(p) {
  const worst = p.direction === 'long' ? p.trough_mark : p.peak_mark;
  if (worst == null) return null;
  const mult = p.instrument_type === 'option' ? 100 : 1;
  const dir = p.direction === 'long' ? 1 : -1;
  return Math.min(0, (Number(worst) - Number(p.entry_price)) * Number(p.quantity) * mult * dir);
}

// "2 × $620 CALL · exp Jul 7 (0DTE)" — the line under an option position's symbol.
export function contractLabel(p) {
  const c = parseOcc(p.occ_symbol);
  if (!c) return p.occ_symbol ? esc(p.occ_symbol) : '';
  const dteTxt = c.dte === 0 ? '0DTE — closes today' : `${c.dte}d`;
  return `<span class="opt-badge ${c.type === 'CALL' ? 'call' : 'put'}">${c.type}</span> $${c.strike} · exp ${c.expLabel} (${dteTxt})`;
}

// Riley's desk instrument panel — the health scorecard the engine stamps on
// every open position each tick (score 0-100, band, flags). Dot = band color;
// hover lists the flags driving it. (Exported — Overview shows the dot too.)
function healthOf(p) {
  try { return p.health ? (typeof p.health === 'string' ? JSON.parse(p.health) : p.health) : null; } catch (_) { return null; }
}
export function healthBadge(p, dotOnly = false) {
  const h = healthOf(p);
  if (!h || h.score == null) return '';
  const cls = h.band === 'HEALTHY' ? 'h-ok' : h.band === 'CRITICAL' ? 'h-crit' : 'h-watch';
  const flags = (h.flags || []).slice(0, 3).join(', ');
  const title = `health ${h.score} (${h.band})${flags ? ' — ' + flags : ''}`;
  return `<span class="health-dot ${cls}" title="${esc(title)}"></span>${dotOnly ? '' : `<span class="health-chip mono" title="${esc(title)}">${h.score}</span>`}`;
}

// The theta clock on a 0DTE: is the mark beating the pure-decay fade line, or
// is decay the only thing moving this position?
function thetaLine(p) {
  const t = healthOf(p)?.theta;
  if (!t || !t.is0dte || t.fadeValue == null) return '';
  return t.thetaBeat
    ? `<div class="theta-line up">beating theta · fade $${t.fadeValue}</div>`
    : `<div class="theta-line down">carried by decay · fade $${t.fadeValue} · ${t.mtcNow != null ? `${t.mtcNow}m left` : ''}</div>`;
}

export function mount(host) {
  host.innerHTML = `
    <div class="positions">
      <h1>Positions</h1>
      <div class="holo">
        <div class="holo-label">Open — Engine-Owned</div>
        <table class="dtable hide-mobile">
          <thead><tr><th>Symbol</th><th>Strategy</th><th>Dir</th><th>Qty</th><th>Entry</th><th>Mark</th><th>Stop / Target</th><th>P&L</th><th>Max DD</th><th></th></tr></thead>
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

// Structure-managed trades show their CHART levels (✕ invalidation / ◎
// objective on the UNDERLYING) instead of raw premium stop/target — the
// levels the trade actually lives and dies by.
function levelsCell(p, compact = false) {
  let st = null;
  try { st = p.structure ? (typeof p.structure === 'string' ? JSON.parse(p.structure) : p.structure) : null; } catch (_) {}
  if (st && (st.invalidation || st.objective)) {
    const inv = st.invalidation != null ? `$${st.invalidation}` : '—';
    const obj = st.objective != null ? `$${st.objective}` : '—';
    return compact ? `✕ ${inv} · ◎ ${obj}` : `<span class="down" title="invalidation (underlying)">✕ ${inv}</span> <span class="up" title="objective (underlying)">◎ ${obj}</span>`;
  }
  return compact
    ? `stop ${p.stop_loss ? money(p.stop_loss) : '—'} · tgt ${p.target ? money(p.target) : '—'}`
    : `${p.stop_loss ? money(p.stop_loss) : '—'} / ${p.target ? money(p.target) : '—'}`;
}

function paint() {
  const body = document.getElementById('p-body');
  const mob = document.getElementById('p-mobile');
  const empty = document.getElementById('p-empty');
  if (!body) return;
  empty.hidden = state.positions.length > 0;

  body.innerHTML = state.positions.map((p) => {
    const m = state.marks[p.id] || {};
    return `<tr>
      <td><b>${esc(p.symbol)}</b>${healthBadge(p)}${p.instrument_type === 'option' ? `<div class="opt-line">${contractLabel(p)}</div>${thetaLine(p)}` : ''}</td>
      <td class="dim">${esc(p.strategy_key)}${String(p.strategy_key || '').startsWith('swing_') ? ' <span class="chip" style="padding:0 5px;color:#fbbf24;border-color:#b4881d">SWING</span>' : ''}</td>
      <td>${esc(p.direction).toUpperCase()}</td>
      <td>${p.quantity}</td>
      <td>${money(p.entry_price)}</td>
      <td>${m.mark != null ? money(m.mark) : '—'}</td>
      <td class="dim">${levelsCell(p)}</td>
      <td class="${pnlClass(m.pnl)}">${m.pnl != null ? money(m.pnl, { sign: true }) : '—'}</td>
      <td class="loss dim">${maxDD(p) != null ? money(maxDD(p), { sign: true }) : '—'}</td>
      <td><button class="btn ghost" style="min-height:32px;padding:2px 12px;font-size:.6rem" data-exit="${p.id}">EXIT</button></td>
    </tr>`;
  }).join('');

  mob.innerHTML = state.positions.map((p) => {
    const m = state.marks[p.id] || {};
    return `<div class="holo pm-card">
      <div class="pm-top"><b class="display" style="font-size:.95rem">${esc(p.symbol)}${healthBadge(p)}</b><span class="${pnlClass(m.pnl)} mono">${m.pnl != null ? money(m.pnl, { sign: true }) : '—'}</span></div>
      ${p.instrument_type === 'option' ? `<div class="pm-detail opt-line">${contractLabel(p)}</div>${thetaLine(p)}` : ''}
      <div class="pm-detail"><span>${esc(p.direction).toUpperCase()} ${p.quantity} @ ${money(p.entry_price)}</span><span>mark ${m.mark != null ? money(m.mark) : '—'}</span></div>
      <div class="pm-detail"><span class="faint">${esc(p.strategy_key)}${String(p.strategy_key || '').startsWith('swing_') ? ' <span class="chip" style="padding:0 5px;color:#fbbf24;border-color:#b4881d">SWING</span>' : ''}</span><span class="faint">${levelsCell(p, true)}</span></div>
      <div class="pm-detail"><span class="faint">max drawdown</span><span class="loss">${maxDD(p) != null ? money(maxDD(p), { sign: true }) : '—'}</span></div>
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
    const { simKill } = await import('../sim.js?v=m36'); // reuse close mechanics
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
