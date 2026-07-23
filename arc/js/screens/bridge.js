// @ts-check
// OVERVIEW — three accounts (💰 Real / Book C $1k / Main $80k), today's record,
// and a scoreboard that means something. Layout: mandate → account cards
// (tappable; each has a tiny sparkline) → Riley's Mind (live brain + feed +
// today's rhythm; series follows the selected card) → Riley's Read → positions
// split by book → Working-today scoreboard + systems strip → engine control.

import * as bus from '../bus.js';
import { state, winRate, hydrate, applyAlertTheme } from '../store.js';
import { killSwitch } from '../components/killswitch.js';
import { money, pnlClass, esc, tTime } from '../components/fmt.js';
import { api, isSim } from '../api.js';
import { simResume, simKill } from '../sim.js?v=m36';
import { contractLabel, healthBadge } from './positions.js';
import { mountBrain, pulseTypeFor, thinkingFor } from '../components/brain.js';

let unsubs = [];
let selCard = 'account';               // 'bookC' | 'account' | 'real' — survives repaints (module scope)
let range = '1d';                     // day series that feeds the card sparklines
let brainCtl = null;                  // Riley's Mind controller (mounted once)
const seriesCache = {};               // range -> /equity-series payload (drives the card sparklines)
let activity = null;                  // /activity payload for the systems strip
let refreshT = null;

export function mount(host) {
  host.innerHTML = `
    <div class="bridge">
      <div class="mandate-banner" id="d-mandate"></div>

      <div class="acct-cards" id="d-cards"></div>

      <div id="d-brain"></div>

      <div class="panel" style="overflow:hidden">
        <div class="panel-head">Riley's Read <a href="#/riley" style="font-weight:500;font-size:12px">Ask Riley ›</a></div>
        <div class="panel-body riley-read" id="d-read"></div>
      </div>

      <div class="bridge-grid">
        <div class="bridge-col">
          <div class="panel" style="overflow:hidden" id="d-panel-real">
            <div class="panel-head" style="display:flex;justify-content:space-between;align-items:center">💰 REAL $ — positions <span id="d-poscount-real" class="faint" style="letter-spacing:0"></span><button class="btn ghost" id="d-flatten-real" style="min-height:30px;padding:2px 10px;font-size:10px;color:#ef4444;border-color:#7f1d1d">EXIT ALL REAL</button></div>
            <div style="overflow-x:auto">
              <table class="dtable"><thead><tr><th>Position</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">P&L</th></tr></thead><tbody id="d-pos-real"></tbody></table>
            </div>
            <div class="empty-note" id="d-pos-real-empty" hidden>No real-money positions — the 💰 lanes are watching for their setup.</div>
          </div>
          <div class="panel" style="overflow:hidden" id="d-panel-bookC">
            <div class="panel-head">Book C (winners only) — positions <span id="d-poscount-bookC" class="faint" style="letter-spacing:0"></span></div>
            <div style="overflow-x:auto">
              <table class="dtable"><thead><tr><th>Position</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">P&L</th></tr></thead><tbody id="d-pos-bookC"></tbody></table>
            </div>
            <div class="empty-note" id="d-pos-bookC-empty" hidden>Book C is flat — waiting for a break-of-structure setup.</div>
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
  brainCtl = mountBrain(host.querySelector('#d-brain'));
  host.querySelector('#d-flatten-real')?.addEventListener('click', async () => {
    if (!confirm('Exit ALL real-money positions at market right now?')) return;
    try { await api.flattenReal(); } catch (e) { alert('Flatten failed: ' + (e.message || e)); }
  });
  host.querySelector('#d-killhint').addEventListener('click', async () => {
    if (!state.engine.state.startsWith('HALTED')) return;
    if (isSim()) simResume(); else await api.resume().catch(() => {});
  });
  // One delegated listener each — survives every repaint.
  host.querySelector('#d-cards').addEventListener('click', (e) => {
    const dot = e.target.closest('[data-dot]');
    if (dot) {   // carousel dot → glide to that card
      const row = host.querySelector('#d-cards .acct-row');
      const target = row?.children[Number(dot.getAttribute('data-dot'))];
      if (row && target) row.scrollTo({ left: Math.max(0, target.offsetLeft - 8), behavior: 'smooth' });
      return;
    }
    const card = e.target.closest('[data-card]');
    if (!card) return;
    selCard = card.getAttribute('data-card');
    paintCards(); highlightGroups(); updateBrain();   // re-target Riley's Mind to the selected account
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
}

export function unmount() {
  unsubs.forEach((u) => u());
  unsubs = [];
  clearInterval(refreshT);
  brainCtl?.destroy(); brainCtl = null;
}

function onEvt(evt) {
  if (evt.type === 'position.mark') {
    paintCards(); paintPositions();     // live P&L between hydrates
  } else if (['position.opened', 'position.closed', 'engine.state', 'kill.activated', 'kill.resumed', 'arbiter.update', 'arbiter.read', 'regime.update'].includes(evt.type)) {
    if (evt.type === 'arbiter.read') lastRead = evt.summary;
    paint();
  }
  // Riley's Mind: fire a colored pulse on every real event, refresh the readout.
  if (evt.type !== 'position.mark' && evt.type !== 'heartbeat') { brainCtl?.pulse(pulseTypeFor(evt.type)); updateBrain(); }
  const term = document.querySelector('#d-ticker');
  if (term) appendTickerRow(term, evt);
}

function paint() { paintMandate(); paintCards(); paintRead(); paintPositions(); paintToday(); paintSystems(); paintEngine(); updateBrain(); }

// Feed live state into Riley's Mind — readout, activity level, and the
// "current trade — what she's thinking" line (from the open position's health).
// Feed Riley's Mind — scoped to the SELECTED account card (positions/hotspots +
// managing count); the live feed + rhythm show the engine's whole-day activity.
const ACCT_LABEL = { bookC: 'BOOK C', real: '💰 REAL', account: 'MAIN' };
function updateBrain() {
  if (!brainCtl) return;
  const now = Date.now();
  const evs = state.events || [];
  const since = (ms) => evs.filter((e) => now - new Date(e.ts).getTime() < ms).length;
  const acctPos = state.positions.filter((p) => (p.book || 'account') === selCard);
  const syms = new Set();
  for (const p of state.positions) if (p.symbol) syms.add(p.symbol);
  brainCtl.update({
    engineState: state.engine?.state,
    live: typeof isLive === 'function' ? isLive() : false,
    acctLabel: ACCT_LABEL[selCard] || 'MAIN',
    watching: Math.max(syms.size, 8),
    evaluating: since(60000),
    managing: acctPos.length,
    dayChangeUsd: state.hero?.dayChangeUsd,
    recentEvents: since(10000),
    positions: acctPos,
    events: evs,
    regime: state.regime?.label || state.regime?.key || null,
  });
}

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
  // Books A/D/B/E/Riley retired — the surviving $1k book is C; Main holds the full
  // roster. A cached selection pointing at a dead book falls back to Main.
  if (['bookD', 'book', 'bookB', 'bookE', 'bookRiley'].includes(selCard)) selCard = 'account';
  const openBookC = state.positions.filter((p) => p.book === 'bookC').length;
  const openReal = state.positions.filter((p) => /_real$/.test(p.strategy_key || '')).length;
  // Main = untagged book only; real positions are tagged 'real' by the API,
  // so subtracting openReal here would double-count them negative.
  const openAcct = state.positions.filter((p) => (p.book || 'account') === 'account' && !/_real$/.test(p.strategy_key || '')).length;

  const bookCVal = h.bookCValue ?? h.bookCEquity;
  // Main = total minus the $1k Book C (the only remaining sub-book). Retired-book
  // equity anchors still echo from the backend but are no longer separate accounts.
  const acctVal = h.equity != null ? h.equity - (bookCVal || 0) : null;
  const acctChg = h.dayChangeUsd != null ? h.dayChangeUsd - (h.bookCDayChangeUsd || 0) : null;
  const acctBase = acctVal != null && acctChg != null ? acctVal - acctChg : null;
  const acctPct = acctBase > 0 && acctChg != null ? +((acctChg / acctBase) * 100).toFixed(2) : null;
  // REAL day %: the real card only had a $ figure (owner 07-23 "match the others
  // with percentage"). Real shows realized P&L today, so derive its % from
  // start-of-day equity (current − realized). At $0 it reads +0% like the others.
  const realChg = t.real?.realizedPnl ?? null;
  const realBase = h.realEquity != null && realChg != null ? h.realEquity - realChg : null;
  const realPct = realBase > 0 && realChg != null ? +((realChg / realBase) * 100).toFixed(2) : (realChg != null && h.realEquity > 0 ? 0 : null);
  const todayBy = { real: { chg: realChg, pct: realPct }, bookC: { chg: h.bookCDayChangeUsd, pct: h.bookCDayChangePct }, account: { chg: acctChg, pct: acctPct } };

  const rec = (r) => r ? `<span class="ac-rec"><b class="gain">${r.wins || 0}W</b> · <b class="loss">${r.losses || 0}L</b> today</span>` : '';
  const card = (key, label, val, chg, pct, r, open, accent) => `
    <div class="acct-card${accent ? ` ${accent}` : ''}${selCard === key ? ' sel' : ''}" data-card="${key}" role="button">
      <div class="ac-label">${label}</div>
      <div class="ac-val mono">${val != null ? money(val, { dp: 2 }) : '—'}</div>
      <div class="ac-chg ${pnlClass(chg)}">${chg != null ? `${money(chg, { sign: true, dp: 2 })}${pct != null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''} today` : '—'}</div>
      ${sparkline(key)}
      <div class="ac-foot">${rec(r)}<span class="ac-open">${open} open</span></div>
    </div>`;

  const s = state.engine.state;
  const engChip = s === 'RUNNING' ? `<span class="chip live">RUNNING · ${isLive() ? 'LIVE' : 'SHADOW'}</span>`
    : s.startsWith('HALTED') ? `<span class="chip halted">${s === 'HALTED_MANUAL' ? 'PAUSED' : 'RISK-HALTED'}</span>`
    : `<span class="chip off">OFFLINE</span>`;

  // Mobile carousel: keep the swipe position across live repaints (marks tick
  // every few seconds — without this the row snaps back to card 1 mid-swipe).
  const prevRow = box.querySelector('.acct-row');
  const prevScroll = prevRow ? prevRow.scrollLeft : 0;
  box.innerHTML =
    `<div class="acct-combined"><span class="faint">Combined</span> <b class="mono">${h.equity != null ? money(h.equity, { dp: 2 }) : '—'}</b> <span class="${pnlClass(h.dayChangeUsd)}">${h.dayChangeUsd != null ? `${money(h.dayChangeUsd, { sign: true, dp: 2 })} today` : ''}</span> ${engChip}</div>`
    + `<div class="acct-row three">`
    + (h.realEquity != null ? card('real', '💰 REAL $ — LIVE MONEY', h.realEquity, realChg, realPct, t.real, openReal, 'realacct') : '')
    + card('bookC', 'BOOK C · $1K — WINNERS ONLY', bookCVal, h.bookCDayChangeUsd, h.bookCDayChangePct, t.bookC, openBookC, 'bookc')
    + card('account', 'MAIN · $80K PAPER — FULL ROSTER', acctVal, acctChg, acctPct, t.account, openAcct, '')
    + `</div>`
    + acctDetail(selCard, todayBy)
    + `<div class="acct-dots" id="d-dots">${Array.from({ length: h.realEquity != null ? 3 : 2 }, (_, i) => `<button class="dot" data-dot="${i}" aria-label="account ${i + 1}"></button>`).join('')}</div>`;
  const row = box.querySelector('.acct-row');
  if (row) {
    if (prevScroll) row.scrollLeft = prevScroll;
    row.addEventListener('scroll', onCardScroll, { passive: true });
    updateDots();
  }
}

// ── Selected-account detail — expands under the row on click (owner 07-23:
// "when clicking an account, show the daily/week gain below") ────────────────
const ACD_NAME = { real: '💰 Real', bookC: 'Book C', account: 'Main' };
function acctDetail(key, todayBy) {
  try {
    const td = todayBy[key] || {};
    const wk = rangeChange(key, '1w');
    const openP = openPnlOf(key);
    const t = state.today || {};
    const rec = key === 'real' ? t.real : key === 'bookC' ? t.bookC : t.account;
    const chgStr = (o) => o && o.chg != null ? `${money(o.chg, { sign: true, dp: 2 })}${o.pct != null ? ` (${o.pct >= 0 ? '+' : ''}${o.pct}%)` : ''}` : '<span class="faint">—</span>';
    const stat = (lbl, val, cls) => `<div style="flex:1;min-width:78px"><div class="faint" style="font-size:10px;letter-spacing:.06em;text-transform:uppercase">${lbl}</div><div class="${cls || ''}" style="font-size:15px;font-weight:600;margin-top:3px">${val}</div></div>`;
    return `<div class="acct-detail" style="display:flex;gap:14px;align-items:center;padding:11px 14px;margin-top:8px;border:1px solid rgba(120,160,200,.14);border-radius:10px;background:rgba(120,160,200,.05)">
      <div class="faint" style="font-size:11px;font-weight:600;min-width:52px">${ACD_NAME[key] || 'Account'}</div>
      ${stat('Today', chgStr(td), pnlClass(td.chg))}
      ${stat('This week', wk ? chgStr(wk) : '<span class="faint">—</span>', wk ? pnlClass(wk.chg) : '')}
      ${stat('Open P&L', money(openP, { sign: true, dp: 2 }), pnlClass(openP))}
      ${stat('Record today', `${(rec && rec.wins) || 0}W · ${(rec && rec.losses) || 0}L`, '')}
    </div>`;
  } catch (_) { return ''; }   // a detail-panel glitch must never break the Overview
}

// Gain over a series range for a card's account (drives This-week on the detail).
function rangeChange(cardKey, rng) {
  const seriesKey = cardKey === 'account' ? 'account' : cardKey === 'bookC' ? 'bookC' : null;
  if (!seriesKey) return null;   // real has no equity series yet → caller shows "—"
  const data = (seriesCache[rng] || {})[seriesKey];
  const ys = (data || []).map((p) => p[1]).filter(Number.isFinite);
  if (ys.length < 2) return null;
  const chg = +(ys[ys.length - 1] - ys[0]).toFixed(2);
  const pct = ys[0] > 0 ? +((chg / ys[0]) * 100).toFixed(2) : null;
  return { chg, pct };
}

// Unrealized P&L on the open positions of one account key (Book C / Main / Real).
function openPnlOf(key) {
  return state.positions.reduce((s, p) => {
    const isReal = /_real$/.test(p.strategy_key || '');
    const inSel = key === 'real' ? isReal : ((p.book || 'account') === key && !isReal);
    if (!inSel) return s;
    const m = state.marks[p.id] || {};
    return s + Number(m.pnl ?? p.pnl ?? 0);
  }, 0);
}

// ── Carousel dots (mobile) ──────────────────────────────────────────────────
let dotRaf = 0;
function onCardScroll() {
  if (dotRaf) return;
  dotRaf = requestAnimationFrame(() => { dotRaf = 0; updateDots(); });
}
function updateDots() {
  const box = document.querySelector('#d-cards');
  const row = box?.querySelector('.acct-row');
  const dots = box?.querySelectorAll('.acct-dots .dot');
  if (!row || !dots || !dots.length) return;
  const cards = [...row.children];
  let idx = 0;
  for (let i = 1; i < cards.length; i++) {
    if (Math.abs(cards[i].offsetLeft - row.scrollLeft) < Math.abs(cards[idx].offsetLeft - row.scrollLeft)) idx = i;
  }
  dots.forEach((d, i) => d.classList.toggle('on', i === idx));
}

function isLive() { return state.engine?.risk_config?.liveTradingEnabled && state.strategies.some((s) => s.enabled && s.mode === 'LIVE'); }

// Tiny inline trend line on each account card (replaces the big equity chart).
// Reads today's per-account series from the cache; renders nothing until loaded.
function sparkline(cardKey) {
  const seriesKey = cardKey === 'account' ? 'account' : cardKey === 'bookC' ? 'bookC' : null;
  if (!seriesKey) return '<div class="ac-spark-wrap"></div>';
  const data = (seriesCache['1d'] || {})[seriesKey];
  const ys = (data || []).map((p) => p[1]).filter(Number.isFinite);
  if (ys.length < 2) return '<div class="ac-spark-wrap"></div>';
  const min = Math.min(...ys), max = Math.max(...ys), rng = (max - min) || 1, W = 100, H = 24;
  const pts = ys.map((y, i) => `${(i / (ys.length - 1) * W).toFixed(1)},${(H - ((y - min) / rng) * H).toFixed(1)}`).join(' ');
  const up = ys[ys.length - 1] >= ys[0], c = up ? '#22c55e' : '#ef4444';
  return `<div class="ac-spark-wrap"><svg class="ac-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg></div>`;
}

// ── Day-open anchor + per-account day series (feed the card sparklines) ─────
function midnightETms() {
  const now = new Date();
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const drift = now.getTime() - etNow.getTime();
  const etMid = new Date(etNow); etMid.setHours(0, 0, 0, 0);
  return etMid.getTime() + drift;
}

async function loadSeries(force = false) {
  // The big equity chart is gone (replaced by Riley's Mind); we still pull the
  // per-account series to paint the tiny sparkline on each account card.
  if (isSim()) { seriesCache[range] = simSeries(); paintCards(); return; }
  if (!seriesCache[range] || force) {
    try { seriesCache[range] = await api.equitySeries(range); } catch (_) { seriesCache[range] = null; }
  }
  // 1-week series drives the "This week" figure in the selected-account detail.
  if (!seriesCache['1w'] || force) {
    try { seriesCache['1w'] = await api.equitySeries('1w'); } catch (_) { seriesCache['1w'] = null; }
  }
  paintCards();
}

// The big uPlot equity chart was retired when Riley's Mind replaced it (no
// #d-chart-wrap in the DOM anymore); loadSeries still pulls the per-account day
// series so sparkline() can draw the tiny trend line on each account card.

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
  const swing = String(p.strategy_key || '').startsWith('swing_') ? ' <span class="chip" style="padding:0 5px;color:#fbbf24;border-color:#b4881d">SWING</span>' : '';
  const realChip = /_real$/.test(p.strategy_key || '') ? ' <span class="chip" style="padding:0 5px;color:#22c55e;border-color:#15803d">💰 REAL</span>' : '';
  return `<tr onclick="location.hash='#/positions'" style="cursor:pointer">
    <td><span class="sym">${esc(p.symbol)}</span>${healthBadge(p, true)}${dir}${swing}${realChip}${contract}<div class="dim" style="font-size:11px">${esc(p.strategy_key)}</div></td>
    <td class="num">${Number(p.quantity)}</td>
    <td class="num">${money(p.entry_price)}</td>
    <td class="num">${mark != null ? money(mark) : '—'}</td>
    <td class="num ${pnlClass(pnl)}">${pnl != null ? money(pnl, { sign: true }) : '—'}${pct != null ? `<div style="font-size:10.5px">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</div>` : ''}</td>
  </tr>`;
}

function paintPositions() {
  const groups = [
    { which: 'real', body: '#d-pos-real', empty: '#d-pos-real-empty', count: '#d-poscount-real' },
    { which: 'bookC', body: '#d-pos-bookC', empty: '#d-pos-bookC-empty', count: '#d-poscount-bookC' },
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
  document.querySelector('#d-panel-bookC')?.classList.toggle('focus', selCard === 'bookC');
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
      <td><span class="sym">${esc(r.strategy_key)}</span>${r.book === 'bookC' ? ' <span class="chip" style="padding:0 5px;color:#a78bfa;border-color:#6d5aa8">C</span>' : String(r.strategy_key || '').startsWith('swing_') ? ' <span class="chip" style="padding:0 5px;color:#fbbf24;border-color:#b4881d">SWING</span>' : ''}</td>
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
  chips.push(`<span class="chip off">Brief · 9:00 AM ET</span>`);
  chips.push(`<span class="chip off">Daily report · 4:15 PM ET</span>`);
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
  // Only the intraday series is used now — sparkline() reads 'account' and
  // 'bookC' (Main + the one surviving $1k book). The range toggle retired with
  // the big chart.
  const now = Date.now(), mid = midnightETms();
  const mk = (start, base, vol) => {
    const out = []; let v = base;
    for (let t = start; t <= now; t += 300000) { v += (Math.random() - 0.46) * vol; out.push([t, +v.toFixed(2)]); }
    return out;
  };
  return { account: mk(mid + 34200000, 24300, 45), bookC: mk(mid + 34200000, 1024, 6) };
}
