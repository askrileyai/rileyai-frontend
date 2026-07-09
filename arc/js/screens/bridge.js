// @ts-check
// OVERVIEW v2 — two accounts, one honest chart, today's record, and a
// scoreboard that means something. Layout: mandate → account cards (Main /
// $1k Book, tappable) → interactive equity chart (uPlot, 1D/1W/1M, series
// follows the selected card, 1D anchored at the midnight equity_open so the
// chart's move EQUALS the card's Today ±) → Riley's Read → positions split by
// book → Working-today scoreboard + systems strip + live feed → engine control.

import * as bus from '../bus.js';
import { state, winRate, hydrate, applyAlertTheme } from '../store.js';
import { killSwitch } from '../components/killswitch.js';
import { money, pnlClass, esc, tTime } from '../components/fmt.js';
import { api, isSim } from '../api.js';
import { simResume, simKill } from '../sim.js';
import { contractLabel } from './positions.js';

let unsubs = [];
let selCard = 'book';                 // 'book' | 'account' — survives repaints (module scope)
let range = '1d';                     // '1d' | '1w' | '1m'
let chart = null;
const seriesCache = {};               // range -> /equity-series payload
let activity = null;                  // /activity payload for the systems strip
let refreshT = null;

export function mount(host) {
  host.innerHTML = `
    <div class="bridge">
      <div class="mandate-banner" id="d-mandate"></div>

      <div class="acct-cards" id="d-cards"></div>

      <div class="panel" style="overflow:hidden">
        <div class="panel-head">
          <span id="d-chart-title">Equity · Today</span>
          <span class="row" style="gap:8px;align-items:center">
            <span id="d-chart-tag" class="faint" style="letter-spacing:0;text-transform:none"></span>
            <span class="fchips" id="d-ranges">
              <button class="fchip on" data-range="1d">1D</button>
              <button class="fchip" data-range="1w">1W</button>
              <button class="fchip" data-range="1m">1M</button>
            </span>
          </span>
        </div>
        <div class="panel-body" style="padding:8px 10px">
          <div id="d-chart-wrap" class="uplot-wrap" style="touch-action:pan-y"></div>
          <div id="d-chart-note" class="empty-note" hidden></div>
        </div>
      </div>

      <div class="panel" style="overflow:hidden">
        <div class="panel-head">Riley's Read <a href="#/riley" style="font-weight:500;font-size:12px">Ask Riley ›</a></div>
        <div class="panel-body riley-read" id="d-read"></div>
      </div>

      <div class="bridge-grid">
        <div class="bridge-col">
          <div class="panel" style="overflow:hidden" id="d-panel-book">
            <div class="panel-head">Book A (A+ setups) — positions <span id="d-poscount-book" class="faint" style="letter-spacing:0"></span></div>
            <div style="overflow-x:auto">
              <table class="dtable"><thead><tr><th>Position</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">P&L</th></tr></thead><tbody id="d-pos-book"></tbody></table>
            </div>
            <div class="empty-note" id="d-pos-book-empty" hidden>Book A is flat — waiting for an A+ setup.</div>
          </div>
          <div class="panel" style="overflow:hidden" id="d-panel-bookB">
            <div class="panel-head">Book B (control) — positions <span id="d-poscount-bookB" class="faint" style="letter-spacing:0"></span></div>
            <div style="overflow-x:auto">
              <table class="dtable"><thead><tr><th>Position</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">P&L</th></tr></thead><tbody id="d-pos-bookB"></tbody></table>
            </div>
            <div class="empty-note" id="d-pos-bookB-empty" hidden>Book B is flat — hunting for setups.</div>
          </div>
          <div class="panel" style="overflow:hidden" id="d-panel-acct">
            <div class="panel-head">Main Account — positions <span id="d-poscount-acct" class="faint" style="letter-spacing:0"></span></div>
            <div style="overflow-x:auto">
              <table class="dtable"><thead><tr><th>Position</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">P&L</th></tr></thead><tbody id="d-pos-acct"></tbody></table>
            </div>
            <div class="empty-note" id="d-pos-acct-empty" hidden>No open account positions.</div>
          </div>
        </div>
        <div class="bridge-col">
          <div class="panel" style="overflow:hidden">
            <div class="panel-head">Working Today <a href="#/playbook" style="font-weight:500;font-size:12px;text-transform:none;letter-spacing:0" id="d-armed-link"></a></div>
            <div style="overflow-x:auto">
              <table class="dtable"><thead><tr><th>Strategy</th><th class="num">Tr</th><th class="num">W–L</th><th class="num">P&L</th></tr></thead><tbody id="d-today"></tbody></table>
            </div>
            <div class="empty-note" id="d-today-empty" hidden>No closed trades yet today.</div>
          </div>
          <div class="panel" style="overflow:hidden">
            <div class="panel-head">Systems</div>
            <div class="panel-body sys-chips" id="d-systems"></div>
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
  // One delegated listener each — survives every repaint.
  host.querySelector('#d-cards').addEventListener('click', (e) => {
    const card = e.target.closest('[data-card]');
    if (!card) return;
    selCard = card.getAttribute('data-card');
    paintCards(); drawChart(); highlightGroups();
  });
  host.querySelector('#d-ranges').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-range]');
    if (!chip) return;
    range = chip.getAttribute('data-range');
    host.querySelectorAll('#d-ranges .fchip').forEach((c) => c.classList.toggle('on', c === chip));
    loadSeries();
  });

  paint();
  highlightGroups();
  paintTicker(host.querySelector('#d-ticker'));
  loadSeries();
  loadActivity();
  refreshT = setInterval(() => { if (!document.hidden) { loadSeries(true); loadActivity(); } }, 120000);

  unsubs = [
    bus.on('state', paint),
    bus.on('alert', paint),
    bus.on('evt', onEvt),
  ];
  window.addEventListener('resize', drawChart);
}

export function unmount() {
  unsubs.forEach((u) => u());
  unsubs = [];
  window.removeEventListener('resize', drawChart);
  clearInterval(refreshT);
  if (chart) { chart.destroy(); chart = null; }
}

function onEvt(evt) {
  if (evt.type === 'position.mark') {
    paintCards(); paintPositions();     // live P&L between hydrates
  } else if (['position.opened', 'position.closed', 'engine.state', 'kill.activated', 'kill.resumed', 'arbiter.update', 'arbiter.read', 'regime.update'].includes(evt.type)) {
    if (evt.type === 'arbiter.read') lastRead = evt.summary;
    paint();
  }
  const term = document.querySelector('#d-ticker');
  if (term) appendTickerRow(term, evt);
}

function paint() { paintMandate(); paintCards(); paintRead(); paintPositions(); paintToday(); paintSystems(); paintEngine(); }

// ── Account cards — the two books, separately, with today's record ─────────
function bookOpenPnl(which) {
  return state.positions.reduce((s, p) => {
    if ((p.book || 'account') !== which) return s;
    const m = state.marks[p.id] || {};
    return s + Number(m.pnl ?? p.pnl ?? 0);
  }, 0);
}

function paintCards() {
  const box = document.querySelector('#d-cards');
  if (!box) return;
  const h = state.hero || {};
  const t = state.today || {};
  const openBook = state.positions.filter((p) => p.book === 'book').length;
  const openBookB = state.positions.filter((p) => p.book === 'bookB').length;
  const openAcct = state.positions.length - openBook - openBookB;

  const bookVal = h.bookValue ?? h.bookEquity;
  const bookBVal = h.bookBValue ?? h.bookBEquity;
  const acctVal = h.equity != null ? h.equity - (bookVal || 0) - (bookBVal || 0) : null;
  const acctChg = h.dayChangeUsd != null ? h.dayChangeUsd - (h.bookDayChangeUsd || 0) - (h.bookBDayChangeUsd || 0) : null;
  const acctBase = acctVal != null && acctChg != null ? acctVal - acctChg : null;
  const acctPct = acctBase > 0 && acctChg != null ? +((acctChg / acctBase) * 100).toFixed(2) : null;

  const rec = (r) => r ? `<span class="ac-rec"><b class="gain">${r.wins || 0}W</b> · <b class="loss">${r.losses || 0}L</b> today</span>` : '';
  const card = (key, label, val, chg, pct, r, open, accent) => `
    <div class="acct-card${accent ? ` ${accent}` : ''}${selCard === key ? ' sel' : ''}" data-card="${key}" role="button">
      <div class="ac-label">${label}</div>
      <div class="ac-val mono">${val != null ? money(val, { dp: 2 }) : '—'}</div>
      <div class="ac-chg ${pnlClass(chg)}">${chg != null ? `${money(chg, { sign: true, dp: 2 })}${pct != null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''} today` : '—'}</div>
      <div class="ac-foot">${rec(r)}<span class="ac-open">${open} open</span></div>
    </div>`;

  const s = state.engine.state;
  const engChip = s === 'RUNNING' ? `<span class="chip live">RUNNING · ${isLive() ? 'LIVE' : 'SHADOW'}</span>`
    : s.startsWith('HALTED') ? `<span class="chip halted">${s === 'HALTED_MANUAL' ? 'PAUSED' : 'RISK-HALTED'}</span>`
    : `<span class="chip off">OFFLINE</span>`;

  box.innerHTML =
    `<div class="acct-combined"><span class="faint">Combined</span> <b class="mono">${h.equity != null ? money(h.equity, { dp: 2 }) : '—'}</b> <span class="${pnlClass(h.dayChangeUsd)}">${h.dayChangeUsd != null ? `${money(h.dayChangeUsd, { sign: true, dp: 2 })} today` : ''}</span> ${engChip}</div>`
    + `<div class="acct-row three">`
    + card('book', 'BOOK A · $1K — A+ SETUPS', bookVal, h.bookDayChangeUsd, h.bookDayChangePct, t.book, openBook, 'book')
    + card('bookB', 'BOOK B · $1K — CONTROL', bookBVal, h.bookBDayChangeUsd, h.bookBDayChangePct, t.bookB, openBookB, 'bookb')
    + card('account', 'MAIN ACCOUNT — strategy lab', acctVal, acctChg, acctPct, t.account, openAcct, '')
    + `</div>`;
}

function isLive() { return state.engine?.risk_config?.liveTradingEnabled && state.strategies.some((s) => s.enabled && s.mode === 'LIVE'); }

// ── The chart — real equity, the selected card's line ──────────────────────
function midnightETms() {
  const now = new Date();
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const drift = now.getTime() - etNow.getTime();
  const etMid = new Date(etNow); etMid.setHours(0, 0, 0, 0);
  return etMid.getTime() + drift;
}

async function loadSeries(force = false) {
  if (isSim()) { seriesCache[range] = simSeries(); drawChart(); return; }
  if (!seriesCache[range] || force) {
    try { seriesCache[range] = await api.equitySeries(range); } catch (_) { seriesCache[range] = null; }
  }
  drawChart();
}

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function drawChart() {
  const wrap = document.querySelector('#d-chart-wrap');
  const note = document.querySelector('#d-chart-note');
  const title = document.querySelector('#d-chart-title');
  if (!wrap || typeof window.uPlot !== 'function') return;
  const cardName = selCard === 'book' ? 'Book A' : selCard === 'bookB' ? 'Book B' : 'Main Account';
  if (title) title.textContent = `${cardName} · ${range === '1d' ? 'Today' : range.toUpperCase()}`;

  const data = seriesCache[range];
  let pts = (data && (selCard === 'book' ? data.book : selCard === 'bookB' ? data.bookB : data.account)) || [];
  pts = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

  const h = state.hero || {};
  if (range === '1d') {
    // Anchor at the day open + live tail, so the visual change equals the card.
    if (selCard === 'account') {
      const open = Number(state.ledger?.equity_open);
      if (open > 0) pts = [[midnightETms(), open], ...pts];
      if (h.equity != null) pts = [...pts, [Date.now(), h.equity]];
    } else {
      const val = selCard === 'bookB' ? (h.bookBValue ?? h.bookBEquity) : (h.bookValue ?? h.bookEquity);
      const chg = selCard === 'bookB' ? h.bookBDayChangeUsd : h.bookDayChangeUsd;
      const dayStart = val != null && chg != null ? val - chg : null;
      if (dayStart != null) pts = [[midnightETms(), dayStart], ...pts];
      if (val != null) pts = [...pts, [Date.now(), val]];
    }
    pts.sort((a, b) => a[0] - b[0]);
  }

  if (chart) { chart.destroy(); chart = null; }
  if (pts.length < 2) {
    if (note) {
      note.hidden = false;
      note.textContent = range === '1d'
        ? 'Collecting today’s samples — one lands every ~3 minutes.'
        : 'Not enough daily history yet — this fills as trading days close.';
    }
    return;
  }
  if (note) note.hidden = true;

  const xs = pts.map((p) => p[0] / 1000);
  const ys = pts.map((p) => p[1]);
  const up = ys[ys.length - 1] >= ys[0];
  const color = selCard === 'book' ? css('--accent-hi') : selCard === 'bookB' ? '#eab308' : (up ? css('--up') : css('--down'));
  const axisStyle = {
    stroke: css('--text-faint'),
    grid: { stroke: 'rgba(63,63,70,.35)' },
    ticks: { stroke: 'rgba(63,63,70,.5)' },
    font: '11px "IBM Plex Mono"',
  };
  const tag = document.querySelector('#d-chart-tag');
  chart = new window.uPlot({
    width: Math.max(wrap.clientWidth || 320, 280),
    height: 180,
    legend: { show: false },
    cursor: { drag: { x: false, y: false }, y: false },
    scales: { x: { time: true } },
    axes: [axisStyle, { ...axisStyle, size: 64 }],
    series: [{}, { stroke: color, width: 2, fill: selCard === 'book' ? 'rgba(34,211,238,.07)' : selCard === 'bookB' ? 'rgba(234,179,8,.07)' : (up ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)') }],
    hooks: {
      setCursor: [(u) => {
        if (!tag) return;
        const i = u.cursor.idx;
        if (i == null || u.data[1][i] == null) { tag.textContent = ''; return; }
        const when = new Date(u.data[0][i] * 1000);
        const lbl = range === '1d'
          ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
          : when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        tag.textContent = `${lbl} · ${money(u.data[1][i], { dp: 2 })}`;
      }],
    },
  }, [xs, ys], wrap);
}

// ── Positions, split by book ────────────────────────────────────────────────
function posRow(p) {
  const m = state.marks[p.id] || {};
  const pnl = m.pnl ?? p.pnl;
  const mark = m.mark ?? p.mark;
  const mult = p.instrument_type === 'option' ? 100 : 1;
  const basis = Number(p.entry_price) * Number(p.quantity) * mult;
  const pct = pnl != null && basis > 0 ? (pnl / basis) * 100 : null;
  const contract = p.instrument_type === 'option' ? `<div class="opt-line">${contractLabel(p)}</div>` : '';
  const dir = p.direction === 'short' ? ' <span class="chip off" style="padding:0 5px">SHORT</span>' : '';
  return `<tr onclick="location.hash='#/positions'" style="cursor:pointer">
    <td><span class="sym">${esc(p.symbol)}</span>${dir}${contract}<div class="dim" style="font-size:11px">${esc(p.strategy_key)}</div></td>
    <td class="num">${Number(p.quantity)}</td>
    <td class="num">${money(p.entry_price)}</td>
    <td class="num">${mark != null ? money(mark) : '—'}</td>
    <td class="num ${pnlClass(pnl)}">${pnl != null ? money(pnl, { sign: true }) : '—'}${pct != null ? `<div style="font-size:10.5px">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>` : ''}</td>
  </tr>`;
}

function paintPositions() {
  const groups = [
    { which: 'book', body: '#d-pos-book', empty: '#d-pos-book-empty', count: '#d-poscount-book' },
    { which: 'bookB', body: '#d-pos-bookB', empty: '#d-pos-bookB-empty', count: '#d-poscount-bookB' },
    { which: 'account', body: '#d-pos-acct', empty: '#d-pos-acct-empty', count: '#d-poscount-acct' },
  ];
  for (const g of groups) {
    const body = document.querySelector(g.body);
    if (!body) continue;
    const rows = state.positions.filter((p) => (p.book || 'account') === g.which);
    document.querySelector(g.empty).hidden = rows.length > 0;
    const count = document.querySelector(g.count);
    if (count) count.textContent = rows.length ? `(${rows.length})` : '';
    body.innerHTML = rows.map(posRow).join('');
  }
}

function highlightGroups() {
  document.querySelector('#d-panel-book')?.classList.toggle('focus', selCard === 'book');
  document.querySelector('#d-panel-bookB')?.classList.toggle('focus', selCard === 'bookB');
  document.querySelector('#d-panel-acct')?.classList.toggle('focus', selCard === 'account');
}

// ── Working today — per-strategy scoreboard (replaces arbiter weights) ─────
function paintToday() {
  const body = document.querySelector('#d-today');
  const empty = document.querySelector('#d-today-empty');
  const link = document.querySelector('#d-armed-link');
  if (!body) return;
  const rows = (state.today?.byStrategy || []).slice(0, 6);
  if (empty) empty.hidden = rows.length > 0;
  if (link) link.textContent = `${state.strategies.filter((s) => s.enabled).length} armed ›`;
  body.innerHTML = rows.map((r) => `
    <tr onclick="location.hash='#/playbook'" style="cursor:pointer">
      <td><span class="sym">${esc(r.strategy_key)}</span>${r.book === 'book' ? ' <span class="chip live" style="padding:0 5px">A</span>' : r.book === 'bookB' ? ' <span class="chip shadow" style="padding:0 5px">B</span>' : ''}</td>
      <td class="num">${r.trades}</td>
      <td class="num"><span class="gain">${r.wins}</span>–<span class="loss">${r.losses}</span></td>
      <td class="num ${pnlClass(r.pnl)}">${money(r.pnl, { sign: true, dp: 0 })}</td>
    </tr>`).join('');
}

// ── Systems strip — what the protective layers did today ───────────────────
async function loadActivity() {
  if (isSim()) { activity = { tapeGate: [{ gate: 'counter_tape', distinct_signals: 3 }], riskGateRejects: 5, scratches: { n: 1, pnl: -21 }, tapeFlipTightens: 2, rileyRides: 1 }; paintSystems(); return; }
  try { activity = await api.activity(24); } catch (_) { activity = null; }
  paintSystems();
}

function paintSystems() {
  const box = document.querySelector('#d-systems');
  if (!box) return;
  const a = activity || {};
  const chips = [];
  const gated = (a.tapeGate || []).reduce((s, g) => s + Number(g.distinct_signals || 0), 0);
  if (gated) chips.push(`<span class="chip off">Tape gate blocked <b>${gated}</b></span>`);
  if (a.riskGateRejects) chips.push(`<span class="chip off">Risk gates <b>${a.riskGateRejects}</b></span>`);
  if (a.scratches?.n) chips.push(`<span class="chip off">Scratches <b>${a.scratches.n}</b> (${money(a.scratches.pnl, { sign: true, dp: 0 })})</span>`);
  if (a.tapeFlipTightens) chips.push(`<span class="chip off">Tape-flip tightens <b>${a.tapeFlipTightens}</b></span>`);
  if (a.rileyRides) chips.push(`<span class="chip live">Rides <b>${a.rileyRides}</b></span>`);
  chips.push(`<span class="chip off">Daily report · 5:00 PM ET</span>`);
  box.innerHTML = chips.join('');
}

// ── Mandate banner (unchanged) ──────────────────────────────────────────────
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

// ── Riley's Read (unchanged) ────────────────────────────────────────────────
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

// ── Engine control (unchanged) ──────────────────────────────────────────────
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

  const t = state.today || {};
  const wr = t.wins + t.losses > 0 ? t.wins / (t.wins + t.losses) : winRate();
  statsEl.innerHTML = `${s.startsWith('HALTED') ? '<span class="eng-lbl">Stopped at</span> ' : ''}` +
    `Today <b class="gain">${t.wins || 0}</b>W / <b class="loss">${t.losses || 0}</b>L${wr != null ? ` · ${Math.round(wr * 100)}% win` : ''} · ${state.positions.length} open`;
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
  const t = state.today || {};
  return `${prefix} · today ${t.wins || 0}W/${t.losses || 0}L · ${state.positions.length} open`;
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

// ── Live ticker (unchanged) ─────────────────────────────────────────────────
const TICK_CLASS = (t) =>
  /^signal\.rejected|^signal\.gated/.test(t) ? 't-veto' :
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

// ── Sim fixtures ────────────────────────────────────────────────────────────
function simSeries() {
  const now = Date.now(), mid = midnightETms();
  const mk = (start, base, vol) => {
    const out = []; let v = base;
    for (let t = start; t <= now; t += 300000) { v += (Math.random() - 0.48) * vol; out.push([t, +v.toFixed(2)]); }
    return out;
  };
  if (range === '1d') return { account: mk(mid + 34200000, 93500, 60), book: mk(mid + 34200000, 1000, 6), bookB: mk(mid + 34200000, 1000, 8) };
  const days = range === '1w' ? 7 : 30;
  const acct = [], book = [], bookB = [];
  let a = 95000, b = 1000, b2 = 1000;
  for (let i = days; i >= 0; i--) {
    a += (Math.random() - 0.45) * 800; b += (Math.random() - 0.42) * 40; b2 += (Math.random() - 0.46) * 50;
    acct.push([now - i * 86400000, +a.toFixed(0)]); book.push([now - i * 86400000, +b.toFixed(0)]); bookB.push([now - i * 86400000, +b2.toFixed(0)]);
  }
  return { account: acct, book, bookB };
}
