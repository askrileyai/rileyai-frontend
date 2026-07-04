// @ts-check
// DECK — the command deck. A dense institutional readout: engine/mode/P&L/
// equity/BP/strategies strip, positions blotter, active-strategies table, a
// live decision ticker, and the kill switch. No reactor — this is a terminal.

import * as bus from '../bus.js';
import { state, thoughtRate, winRate, openPnl, hydrate, applyAlertTheme } from '../store.js';
import { drawSparkline } from '../components/sparkline.js';
import { killSwitch } from '../components/killswitch.js';
import { money, pnlClass, esc, tTime } from '../components/fmt.js';
import { api, isSim } from '../api.js';
import { simResume, simKill } from '../sim.js';

let unsubs = [];
let equityPoints = [];

export function mount(host) {
  host.innerHTML = `
    <div class="bridge">
      <div class="mandate-banner" id="d-mandate"></div>

      <div class="deck-readout" id="d-readout"></div>

      <div class="track-record" id="d-record"></div>

      <div class="panel" style="overflow:hidden">
        <div class="panel-head">Riley's Read <a href="#/riley" style="font-weight:500;font-size:12px">Ask Riley ›</a></div>
        <div class="panel-body riley-read" id="d-read"></div>
      </div>

      <div class="panel" style="overflow:hidden">
        <div class="panel-head">Equity · Session <span class="row" style="gap:12px"><span id="d-spark-tag" class="faint"></span><a href="#/performance" style="font-weight:500;font-size:12px">Performance ›</a></span></div>
        <div class="panel-body" style="padding:10px 14px"><canvas id="d-spark" style="width:100%;height:56px;display:block"></canvas></div>
      </div>

      <div class="bridge-grid">
        <div class="panel" style="overflow:hidden">
          <div class="panel-head">Open Positions <span id="d-poscount" class="faint" style="letter-spacing:0"></span></div>
          <div style="overflow-x:auto">
            <table class="dtable"><thead><tr><th>Sym</th><th>Strat</th><th>Dir</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">P&L</th></tr></thead><tbody id="d-positions"></tbody></table>
          </div>
          <div class="empty-note" id="d-pos-empty" hidden>No open positions.</div>
        </div>
        <div class="bridge-col">
          <div class="panel" style="overflow:hidden">
            <div class="panel-head">Active Strategies</div>
            <div style="overflow-x:auto">
              <table class="dtable"><thead><tr><th>Strategy</th><th>Mode</th><th class="num">W</th></tr></thead><tbody id="d-strats"></tbody></table>
            </div>
            <div class="empty-note" id="d-strat-empty" hidden>None armed. See Playbook.</div>
          </div>
          <div class="panel deck-ticker" style="overflow:hidden">
            <div class="panel-head">Live Feed <a href="#/mind" class="faint" style="text-transform:none;letter-spacing:0">open ›</a></div>
            <div class="terminal" id="d-ticker"></div>
          </div>
        </div>
      </div>

      <div class="panel engine-ctl" style="overflow:hidden">
        <div class="panel-head">Engine Control <span id="d-eng-chip" class="chip">—</span></div>
        <div class="panel-body">
          <div id="d-eng-actions" class="eng-actions"></div>
          <div id="d-eng-stats" class="eng-stats"></div>
          <div class="bridge-killrow">
            <span class="kill-hint" id="d-killhint">Hold to arm · L1 pause · L2 cancel orders · L3 flatten all</span>
            <span id="d-kill"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  host.querySelector('#d-kill').appendChild(killSwitch());
  host.querySelector('#d-killhint').addEventListener('click', async () => {
    if (!state.engine.state.startsWith('HALTED')) return;
    if (isSim()) simResume(); else await api.resume().catch(() => {});
  });

  equityPoints = state.equityCurve ? [...state.equityCurve] : [];
  paint();
  paintTicker(host.querySelector('#d-ticker'));
  drawSpark();

  unsubs = [
    bus.on('state', paint),
    bus.on('alert', paint),
    bus.on('evt', onEvt),
  ];
  window.addEventListener('resize', drawSpark);
}

export function unmount() {
  unsubs.forEach((u) => u());
  unsubs = [];
  window.removeEventListener('resize', drawSpark);
}

function onEvt(evt) {
  if (evt.type === 'position.mark') {
    const eq = currentEquity();
    if (eq != null) { equityPoints.push(eq); if (equityPoints.length > 240) equityPoints.shift(); drawSpark(); }
    paintReadout(); paintRecord(); paintPositions();
  } else if (['position.opened', 'position.closed', 'engine.state', 'kill.activated', 'kill.resumed', 'arbiter.update', 'arbiter.read', 'regime.update'].includes(evt.type)) {
    if (evt.type === 'arbiter.read') lastRead = evt.summary;
    paint();
  }
  const term = document.querySelector('#d-ticker');
  if (term) appendTickerRow(term, evt);
}

function currentEquity() {
  const base = state.equity ?? state.balance?.cash;
  return base == null ? null : Number(base) + Number(state.unrealized || 0);
}

function paint() { paintMandate(); paintReadout(); paintRecord(); paintRead(); paintPositions(); paintStrats(); paintEngine(); }

// Engine control — current state + the right action (Start / Pause / Resume) +
// a live session-stats line so stopping ALWAYS shows where the engine stands.
function paintEngine() {
  const chip = document.querySelector('#d-eng-chip');
  const actions = document.querySelector('#d-eng-actions');
  const statsEl = document.querySelector('#d-eng-stats');
  if (!chip || !actions || !statsEl) return;
  const s = state.engine.state || 'OFF';
  chip.className = 'chip ' + (s === 'RUNNING' ? 'live' : s.startsWith('HALTED') ? 'halted' : 'off');
  chip.textContent = { OFF: 'OFFLINE', RUNNING: 'RUNNING', HALTED_MANUAL: 'PAUSED', HALTED_RISK: 'RISK-HALTED' }[s] || s;

  let btn;
  if (s === 'OFF') btn = `<button class="btn" data-eng="start">▶ Start engine</button>`;
  else if (s === 'RUNNING') btn = `<button class="btn ghost" data-eng="pause">⏸ Pause · halt new entries</button>`;
  else btn = `<button class="btn" data-eng="resume">▶ Resume engine</button>`;
  const reason = s.startsWith('HALTED') && state.engine.state_reason ? `<span class="eng-reason">${esc(state.engine.state_reason)}</span>` : '';
  actions.innerHTML = btn + reason;
  actions.querySelector('[data-eng]')?.addEventListener('click', (e) => engineAction(e.currentTarget.getAttribute('data-eng')));

  const wr = winRate();
  const rec = state.record || { wins: 0, losses: 0, closedPnl: 0 };
  const sess = Number(state.todayPnl || 0) + Number(state.unrealized || 0);
  statsEl.innerHTML = `${s.startsWith('HALTED') ? '<span class="eng-lbl">Stopped at</span> ' : ''}` +
    `<span class="${pnlClass(sess)}">${money(sess, { sign: true })}</span> session · ` +
    `<b class="gain">${rec.wins || 0}</b>W / <b class="loss">${rec.losses || 0}</b>L${wr != null ? ` · ${Math.round(wr * 100)}% win` : ''} · ` +
    `realized <span class="${pnlClass(rec.closedPnl)}">${money(rec.closedPnl || 0, { sign: true, dp: 0 })}</span> · ${state.positions.length} open`;
}

async function engineAction(kind) {
  if (isSim()) {
    if (kind === 'pause') { simKill(1, 'manual pause (hud)'); toast(sessionLine('Paused')); }
    else { state.engine.state = 'RUNNING'; state.engine.state_reason = null; applyAlertTheme(); bus.emit('state', state); toast(kind === 'start' ? 'Engine started.' : 'Engine resumed.'); }
    return;
  }
  try {
    if (kind === 'start') { await api.start(); toast('Engine started.'); }
    else if (kind === 'resume') { await api.resume(); toast('Engine resumed.'); }
    else if (kind === 'pause') { await api.kill(1, 'pause (hud)'); toast(sessionLine('Paused')); }
    await hydrate();
  } catch (e) { toast(`Action failed: ${e.message}`); }
}

function sessionLine(prefix) {
  const rec = state.record || {};
  const sess = Number(state.todayPnl || 0) + Number(state.unrealized || 0);
  const wr = winRate();
  return `${prefix} · ${money(sess, { sign: true })} session · ${rec.wins || 0}W/${rec.losses || 0}L${wr != null ? ` (${Math.round(wr * 100)}%)` : ''} · ${state.positions.length} open`;
}

let toastT = null;
function toast(msg) {
  let el = document.getElementById('d-toast');
  if (!el) { el = document.createElement('div'); el.id = 'd-toast'; el.className = 'set-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 4200);
}

// Mandate banner — the goal Riley is trading toward, always visible on home.
function paintMandate() {
  const box = document.querySelector('#d-mandate');
  if (!box) return;
  const m = state.mandate || {};
  const auto = { manual: 'Manual', guided: 'Guided', full: 'Full Auto' }[m.autonomy] || 'Guided';
  const appetite = (m.riskAppetite || 'balanced');
  if (!m.goal) {
    box.innerHTML = `<span class="mb-icon">◎</span><span class="mb-text dim">No goal set — tell Riley what you want (e.g. "make ~$400/week trading options").</span><a href="#/riley" class="mb-cta">Set a goal ›</a>`;
    return;
  }
  box.innerHTML = `<span class="mb-icon">◎</span><span class="mb-text"><b>Goal:</b> ${esc(m.goal)}</span><span class="mb-tags"><span class="chip live">${auto}</span><span class="chip off" style="text-transform:capitalize">${esc(appetite)}</span></span><a href="#/armory" class="mb-cta">Adjust ›</a>`;
}

// Track record — win %, winning, losing, current trades with +/- (all connected).
function paintRecord() {
  const box = document.querySelector('#d-record');
  if (!box) return;
  const wr = winRate();
  const rec = state.record || { wins: 0, losses: 0, closedPnl: 0 };
  const open = state.positions.length;
  const openP = openPnl();
  const cells = [
    ['Win Rate', wr != null ? Math.round(wr * 100) + '%' : '—', wr != null && wr >= 0.5 ? 'up' : ''],
    ['Winning Trades', String(rec.wins), 'up'],
    ['Losing Trades', String(rec.losses), 'down'],
    ['Open Now', `${open}`, ''],
    ['Open P&L', money(openP, { sign: true }), pnlClass(openP)],
    ['Realized', money(rec.closedPnl, { sign: true, dp: 0 }), pnlClass(rec.closedPnl)],
  ];
  box.innerHTML = cells.map(([l, v, c]) =>
    `<div class="tr-cell"><div class="tr-val ${c || ''}">${v}</div><div class="tr-lbl">${l}</div></div>`
  ).join('');
}

// "Riley's Read": which strategy is favored now + why (plain language).
// Real mode fills from the latest arbiter.read decision event; sim uses a
// sensible default keyed to the enabled strategies.
let lastRead = null;
function paintRead() {
  const box = document.querySelector('#d-read');
  if (!box) return;
  const reg = state.regime;
  const auto = { manual: 'Manual', guided: 'Guided', full: 'Full Auto' }[state.mandate?.autonomy] || 'Guided';
  const enabled = state.strategies.filter((s) => s.enabled);
  const readLine = lastRead || (reg && reg.read) ||
    (enabled.length ? `Favoring ${enabled[0].name || enabled[0].strategy_key} in current conditions.` : 'No strategies armed yet — arm one in Strategies or ask Riley to set one up.');
  const favored = enabled.filter((s) => Number(s.arbiter_weight ?? 1) >= 0.9);
  const stood = enabled.filter((s) => Number(s.arbiter_weight ?? 1) === 0);
  const situation = reg
    ? `<div class="rr-situation"><span class="rr-sit-dot"></span>${esc(reg.label)} · VIX ${reg.vix} · <b>${auto}</b>${auto === 'Full Auto' ? ' — hunting market-wide' : ''}</div>`
    : '';
  const favChips = favored.slice(0, 4).map((s) => `<span class="chip live">${esc(s.name || s.strategy_key)}</span>`).join('');
  const stoodChips = stood.slice(0, 2).map((s) => `<span class="chip off">${esc((s.name || s.strategy_key).split(' ·')[0])} · stood down</span>`).join('');
  box.innerHTML = `${situation}<div class="rr-line">${esc(readLine)}</div>${(favChips || stoodChips) ? `<div class="rr-fav">${favChips}${stoodChips}</div>` : ''}`;
}

function paintReadout() {
  const box = document.querySelector('#d-readout');
  if (!box) return;
  const s = state.engine.state;
  const pnl = Number(state.todayPnl || 0) + Number(state.unrealized || 0);
  const stateCls = s === 'RUNNING' ? 'state-running' : s.startsWith('HALTED') ? 'state-halted' : '';
  const mode = s === 'RUNNING' ? (isLive() ? 'LIVE' : 'SHADOW') : '—';
  const cells = [
    ['Engine', `<span class="ro-value ${stateCls}">${esc(s)}</span>`],
    ['Mode', `<span class="ro-value">${mode}</span>`],
    ['Session P&L', `<span class="ro-value big ${pnlClass(pnl)}">${money(pnl, { sign: true })}</span>`],
    ['Equity', `<span class="ro-value">${money(currentEquity(), { dp: 0 })}</span>`],
    ['Buying Power', `<span class="ro-value">${money(state.balance?.buyingPower, { dp: 0 })}</span>`],
    ['Strategies', `<span class="ro-value">${state.strategies.filter((x) => x.enabled).length} <span class="faint" style="font-size:13px">/ ${state.strategies.length}</span></span>`],
  ];
  box.innerHTML = cells.map(([l, v]) => `<div class="ro"><div class="ro-label">${l}</div>${v}</div>`).join('');
}

function isLive() { return state.engine?.risk_config?.liveTradingEnabled && state.strategies.some((s) => s.enabled && s.mode === 'LIVE'); }

function paintPositions() {
  const body = document.querySelector('#d-positions');
  const empty = document.querySelector('#d-pos-empty');
  const count = document.querySelector('#d-poscount');
  if (!body) return;
  empty.hidden = state.positions.length > 0;
  if (count) count.textContent = state.positions.length ? `(${state.positions.length})` : '';
  body.innerHTML = state.positions.map((p) => {
    const m = state.marks[p.id] || {};
    return `<tr onclick="location.hash='#/positions'" style="cursor:pointer">
      <td><span class="sym">${esc(p.symbol)}</span></td>
      <td class="dim">${esc(p.strategy_key)}</td>
      <td>${esc(p.direction).toUpperCase()}</td>
      <td class="num">${p.quantity}</td>
      <td class="num">${money(p.entry_price)}</td>
      <td class="num">${m.mark != null ? money(m.mark) : '—'}</td>
      <td class="num ${pnlClass(m.pnl)}">${m.pnl != null ? money(m.pnl, { sign: true }) : '—'}</td>
    </tr>`;
  }).join('');
}

function paintStrats() {
  const body = document.querySelector('#d-strats');
  const empty = document.querySelector('#d-strat-empty');
  if (!body) return;
  const enabled = state.strategies.filter((s) => s.enabled);
  empty.hidden = enabled.length > 0;
  body.innerHTML = enabled.map((s) => `
    <tr onclick="location.hash='#/playbook'" style="cursor:pointer">
      <td><span class="sym">${esc(s.name || s.strategy_key)}</span></td>
      <td><span class="chip ${s.mode === 'LIVE' ? 'live' : 'shadow'}">${s.mode}</span></td>
      <td class="num">${Number(s.arbiter_weight ?? 1).toFixed(2)}</td>
    </tr>`).join('');
}

// ---- live ticker (compact tail of the decision feed) ----
const TICK_CLASS = (t) =>
  /^signal\.rejected/.test(t) ? 't-veto' :
  /^signal\./.test(t) ? 't-signal' :
  /^order\.filled|^position\.opened/.test(t) ? 't-fill' :
  /^kill\.|^risk\.halt/.test(t) ? 't-halt' :
  /^ai\./.test(t) ? 't-ai' :
  /^strategy\.scan|^position\.mark|^heartbeat/.test(t) ? 't-scan' : 't-info';

function paintTicker(term) {
  if (!term) return;
  term.innerHTML = '';
  for (const evt of state.events.slice(-40)) appendTickerRow(term, evt);
  term.scrollTop = term.scrollHeight;
}

function appendTickerRow(term, evt) {
  if (evt.type === 'position.mark' || evt.type === 'heartbeat') return;
  const row = document.createElement('div');
  row.className = `t-row ${TICK_CLASS(evt.type)}`;
  row.innerHTML = `<span class="t-time">${tTime(evt.ts)}</span>${esc(evt.summary)}`;
  const atEnd = term.scrollTop + term.clientHeight >= term.scrollHeight - 30;
  term.appendChild(row);
  while (term.children.length > 60) term.removeChild(term.firstChild);
  if (atEnd) term.scrollTop = term.scrollHeight;
}

function drawSpark() {
  const canvas = document.querySelector('#d-spark');
  if (!canvas) return;
  if (equityPoints.length < 2) { const eq = currentEquity(); if (eq != null) equityPoints = [eq, eq]; else return; }
  drawSparkline(canvas, equityPoints);
  const tag = document.querySelector('#d-spark-tag');
  if (tag && equityPoints.length > 1) {
    const chg = equityPoints[equityPoints.length - 1] - equityPoints[0];
    tag.textContent = `${chg >= 0 ? '+' : ''}${money(chg, { dp: 0 })} session`;
  }
}
