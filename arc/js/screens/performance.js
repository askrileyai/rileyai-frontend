// @ts-check
// PERFORMANCE — equity curve + daily P&L (uPlot), stat pods, attribution.

import { state } from '../store.js';
import { api, isSim } from '../api.js';
import { money, esc } from '../components/fmt.js';

let plots = [];
let calData = new Map();   // 'YYYY-MM-DD' -> { pnl, trades, wins, losses }
let calCursor = null;      // Date at the 1st of the displayed month

export function mount(host) {
  host.innerHTML = `
    <div class="performance">
      <div class="row spread">
        <h1>Performance</h1>
        <div class="filters" id="pf-windows">
          ${['1d', '1w', '1m', 'all'].map((w) => `<button class="fchip ${w === '1w' ? 'on' : ''}" data-w="${w}">${w}</button>`).join('')}
        </div>
      </div>
      <div class="perf-pods" id="pf-pods"></div>
      <div class="holo">
        <div class="holo-label">Daily Report · 5:00 PM ET · graded vs the &gt;50% win-rate mission</div>
        <div id="pf-daily-reports" class="reports"><div class="empty-note">Loading reports…</div></div>
      </div>
      <div class="holo book-card">
        <div class="holo-label">$1k Small-Account Book · the real-money rehearsal</div>
        <div id="pf-book" class="acct-recon"><div class="empty-note">Loading the book…</div></div>
      </div>
      <div class="holo">
        <div class="holo-label">Account · where every dollar is</div>
        <div id="pf-account" class="acct-recon"><div class="empty-note">Reconciling against the broker…</div></div>
      </div>
      <div class="holo">
        <div class="holo-label">Daily P&L Calendar</div>
        <div id="pf-calendar" class="calendar"></div>
      </div>
      <div class="holo"><div class="holo-label">Equity Curve</div><div class="uplot-wrap" id="pf-equity"></div></div>
      <div class="holo"><div class="holo-label">Daily P&L</div><div class="uplot-wrap" id="pf-daily"></div></div>
      <div class="holo">
        <div class="row spread">
          <div class="holo-label">Strategy Attribution</div>
          <div class="filters" id="pf-books">
            <button class="fchip on" data-book="all">All</button>
            <button class="fchip" data-book="real">💰 Real</button>
            <button class="fchip" data-book="small_c">Book C</button>
            <button class="fchip" data-book="lab">Main</button>
          </div>
        </div>
        <table class="dtable"><thead><tr><th>Strategy</th><th>Trades</th><th>Win %</th><th>Avg R</th><th>P&L</th></tr></thead><tbody id="pf-attr"></tbody></table>
      </div>
    </div>
  `;
  host.querySelectorAll('#pf-windows .fchip').forEach((chip) => {
    chip.addEventListener('click', () => {
      host.querySelectorAll('#pf-windows .fchip').forEach((c) => c.classList.remove('on'));
      chip.classList.add('on');
      load(chip.getAttribute('data-w'));
    });
  });
  host.querySelectorAll('#pf-books .fchip').forEach((chip) => {
    chip.addEventListener('click', () => {
      host.querySelectorAll('#pf-books .fchip').forEach((c) => c.classList.remove('on'));
      chip.classList.add('on');
      loadBookAttribution(chip.getAttribute('data-book'));
    });
  });
  load('1w');
  loadCalendar();
  loadAccount();
  loadBook();
  loadDailyReports();
}

// ── The 5:00 PM ET DAILY REPORT — the desk's daily improvement engine ──────
// One unified end-of-day read: both books, the shadow book's verdict on every
// gate ("did declining those trades save or cost money"), system activity, a
// process grade, and explicit improve / steady / delete / add actions. Renders
// the persisted review.daily event; live preview before the 5pm run lands.
async function loadDailyReports() {
  const host = document.getElementById('pf-daily-reports');
  if (!host) return;
  const strat = (r) => ((r && r.byStrategy) || []).slice(0, 6).map((s) =>
    `<tr><td>${esc(s.key)}</td><td>${s.trades}</td><td>${s.winRate != null ? Math.round(s.winRate * 100) + '%' : '—'}</td><td class="${(s.pnl || 0) >= 0 ? 'gain' : 'loss'}">${money(s.pnl || 0, { sign: true, dp: 0 })}</td></tr>`).join('');
  const stratTable = (review) => review && (review.byStrategy || []).length
    ? `<table class="dtable report-table"><thead><tr><th>Strategy</th><th>Tr</th><th>Win</th><th>P&L</th></tr></thead><tbody>${strat(review)}</tbody></table>`
    : `<div class="empty-note">No closed trades in the window.</div>`;

  const ACTION_COLORS = { improve: '#22d3ee', steady: '#a1a1aa', delete: '#ef4444', add: '#22c55e' };
  const chip = (t) => `<span style="display:inline-block;padding:1px 8px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#09090b;background:${ACTION_COLORS[t] || '#a1a1aa'}">${esc((t || '').toUpperCase())}</span>`;
  const gradeBadge = (g) => g ? `<span style="display:inline-block;min-width:34px;text-align:center;padding:2px 8px;border-radius:9px;font-weight:800;font-size:15px;background:${/^A/.test(g) ? '#22c55e' : /^B/.test(g) ? '#22d3ee' : /^C/.test(g) ? '#eab308' : '#ef4444'};color:#09090b">${esc(g)}</span>` : '';

  const shadowLine = (sh) => {
    if (!sh || !sh.overall || !sh.overall.blocked) return '';
    const o = sh.overall;
    const saved = Number(o.savedUsdPerContract || 0);
    return `<div class="report-summary">Declined trades: <b>${o.blocked}</b> tracked — ${o.wouldWin} would have won (${Math.round((o.wouldWinRate || 0) * 100)}%) · gates ${saved >= 0 ? `<span class="gain">saved ${money(saved, { dp: 0 })}</span>` : `<span class="loss">cost ${money(-saved, { dp: 0 })}</span>`}/contract</div>`;
  };

  // The unified report event (5pm cron or on-demand run)
  const unified = (ev) => {
    const d = ev.data || {}, ai = d.report || {}, small = d.small, bookC = d.bookC, lab = d.lab, gates = d.gates || {}, sb = d.scoreboard;
    const vc = bookC?.virtualEquity;
    // Surviving books only: 💰 Real, Book C (discipline · caps), and Main (lab =
    // full roster). Books A/B/D/E/Riley retired — old cached reports still render
    // via the section guards below.
    // Per-book scoreboard (deterministic, computed backend-side at report time).
    const sbTable = (s) => {
      if (!s || !s.day) return '';
      const row = (name, label) => {
        const day = s.day?.[name], wk = s.week?.[name];
        const cell = (x) => x && x.trades ? `${x.trades}tr · ${x.winRate != null ? x.winRate + '%' : '—'} · <span class="${pnlClass(x.pnl)}">${money(x.pnl, { sign: true, dp: 0 })}</span>${x.profitFactor != null ? ` · PF ${x.profitFactor}` : ''}` : '<span class="faint">—</span>';
        return `<tr><td>${label}</td><td>${cell(day)}</td><td>${cell(wk)}</td></tr>`;
      };
      return `<div style="overflow-x:auto;margin-top:8px"><table class="dtable"><thead><tr><th>Book</th><th>Today</th><th>Week</th></tr></thead><tbody>
        ${row('REAL', '💰 REAL $')}${row('C', 'C · Discipline · caps')}${row('lab', 'Main · full roster')}
      </tbody></table></div>`;
    };
    const crownLine = ai.crown ? `<div class="report-summary"><b>👑 Today: Book ${esc(ai.crown.today || '—')}</b> · Week leader: Book ${esc(ai.crown.week || '—')}${ai.crown.evidence ? ` — ${esc(ai.crown.evidence)}` : ''}</div>` : '';
    // Live-vs-backtest drift per benchmarked lane (the test week's verdict instrument).
    const vsB = sb?.vsBenchmark;
    const vsBlock = vsB && vsB.length ? `<div style="overflow-x:auto;margin-top:8px"><table class="dtable"><thead><tr><th>Lane (live vs test)</th><th class="num">Trades</th><th class="num">Live WR</th><th class="num">Test WR</th><th class="num">Drift</th></tr></thead><tbody>
      ${vsB.map((x) => `<tr><td>${esc(x.key)}</td><td class="num">${x.trades}</td><td class="num">${x.liveWR}%</td><td class="num dim">${x.testWR}%</td><td class="num ${x.drift >= 0 ? 'up' : 'down'}">${x.drift >= 0 ? '+' : ''}${x.drift}</td></tr>`).join('')}
    </tbody></table></div>` : '';
    const acts = (ai.actions || []).slice(0, 6).map((a) =>
      `<div style="margin:4px 0">${chip(a.type)} <b>${esc(a.target || '')}</b> — ${esc(a.action || '')}${a.evidence ? ` <span class="faint">(${esc(a.evidence)}${a.confidence ? ` · ${esc(a.confidence)}` : ''})</span>` : ''}</div>`).join('');
    const gateBits = [];
    if ((gates.tapeGate || []).length) gateBits.push(`tape gate blocked ${gates.tapeGate.reduce((s, g) => s + (g.distinct_signals || 0), 0)} signal(s)`);
    if (gates.scratches?.n) gateBits.push(`${gates.scratches.n} scratch(es) ${money(gates.scratches.pnl, { sign: true, dp: 0 })}`);
    if (gates.tapeFlipTightens) gateBits.push(`${gates.tapeFlipTightens} tape-flip tighten(s)`);
    if (gates.rileyRides) gateBits.push(`${gates.rileyRides} ride(s)`);
    if (gates.desk?.calls) {
      const by = (gates.desk.byAction || []).map((a) => `${a.n} ${a.action}`).join('/');
      gateBits.push(`desk ${gates.desk.calls} call(s)${by ? ` (${by})` : ''}${gates.desk.overrides ? ` · ${gates.desk.overrides} override(s)` : ''}${gates.desk.failures ? ` · ${gates.desk.failures} failed` : ''}`);
    }
    return `
    <div class="report-block">
      <div class="report-head"><b>DAILY REPORT ${gradeBadge(ai.grade)}</b><span class="faint">${new Date(ev.ts || ev.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>
      ${ai.headline ? `<div class="report-summary"><b>${esc(ai.headline)}</b></div>` : ''}
      ${crownLine}
      ${sbTable(sb)}
      ${vsBlock}
      ${bookC ? `<div class="report-summary" style="margin-top:8px">BOOK C (Discipline · caps) — ${vc ? `equity <b>${money(vc.equity, { dp: 2 })}</b> (${vc.realizedPnl >= 0 ? '+' : ''}${money(vc.realizedPnl, { dp: 2 })})` : ''} · ${bookC?.overall?.trades ?? 0} trades${ai.bookCRead ? ` · ${esc(ai.bookCRead)}` : ''}</div>${stratTable(bookC)}` : ''}
      ${ai.rileyRead ? `<div class="report-summary" style="margin-top:8px">🧠 RILEY'S EXITS vs THE PLAYBOOK — ${esc(ai.rileyRead)}</div>` : ''}
      ${d.real ? `<div class="report-summary" style="margin-top:8px">💰 REAL $ (live money) — ${d.real?.overall?.trades ?? 0} trades, ${money(d.real?.overall?.pnl || 0, { sign: true, dp: 2 })}${ai.realRead ? ` · ${esc(ai.realRead)}` : ''}</div>${stratTable(d.real)}` : ''}
      <div class="report-summary" style="margin-top:8px">LAB — ${lab?.overall ? `${lab.overall.trades} trades, ${lab.overall.winRate != null ? Math.round(lab.overall.winRate * 100) + '% win' : '—'}, ${money(lab.overall.pnl || 0, { sign: true, dp: 0 })}` : ''}${ai.labRead ? ` · ${esc(ai.labRead)}` : ''}</div>
      ${stratTable(lab)}
      ${shadowLine(small?.shadow) || shadowLine(lab?.shadow)}
      ${ai.systemsRead ? `<div class="report-summary">${gateBits.length ? esc(gateBits.join(' · ')) + ' — ' : ''}${esc(ai.systemsRead)}</div>` : ''}
      ${acts ? `<div class="report-recs" style="margin-top:8px"><div class="faint" style="margin-bottom:2px">ACTIONS — improve · steady · delete · add</div>${acts}</div>` : ''}
      ${(ai.tomorrowFocus || []).length ? `<div class="report-recs">${ai.tomorrowFocus.slice(0, 3).map((x) => `<div>→ ${esc(x)}</div>`).join('')}</div>` : ''}
    </div>`;
  };

  // Legacy two-block rendering (pre-unified events)
  const block = (title, ts, summary, review, ai) => `
    <div class="report-block">
      <div class="report-head"><b>${esc(title)}</b><span class="faint">${ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'live preview'}</span></div>
      ${summary ? `<div class="report-summary">${esc(summary)}</div>` : ''}
      ${stratTable(review)}
      ${ai?.recommendations?.length ? `<div class="report-recs">${ai.recommendations.slice(0, 3).map((x) => `<div>→ ${esc(x.change || x)}</div>`).join('')}</div>` : ''}
    </div>`;

  if (isSim()) {
    host.innerHTML = unified({ ts: Date.now(), data: { report: { headline: 'Disciplined day on a hard tape — gates earned their keep.', grade: 'B', bookRead: 'Two clean wins, one scratch.', labRead: 'Shorts carried the day.', systemsRead: 'Tape gate blocked 4 longs; 3 would have lost.', actions: [{ type: 'steady', target: 'zero_dte_7d', action: 'hold as-is', evidence: '2/3 today', confidence: 'medium' }, { type: 'improve', target: 'counter_tape gate', action: 'keep 0.72 bar', evidence: 'blocks 75% would-lose', confidence: 'medium' }], tomorrowFocus: ['Watch ORB with the real 9:30 range'] }, small: { virtualEquity: { equity: 1042, realizedPnl: 42 }, overall: { trades: 5 }, byStrategy: [{ key: 'zero_dte_momentum', trades: 4, winRate: 0.75, pnl: 38 }], shadow: { overall: { blocked: 4, wouldWin: 1, wouldWinRate: 0.25, savedUsdPerContract: 96 } } }, lab: { overall: { trades: 31, winRate: 0.42, pnl: 212 }, byStrategy: [{ key: 'scalp_equity', trades: 8, winRate: 0.88, pnl: 64 }] }, gates: { tapeGate: [{ gate: 'counter_tape', distinct_signals: 4 }], scratches: { n: 1, pnl: -22 }, tapeFlipTightens: 2, rileyRides: 1 } } });
    return;
  }
  try {
    const evs = (await api.log('?limit=10&type=review.daily')).events || [];
    // Only pin TODAY'S report (ET) — a stale one measures a dead window and
    // contradicts the live book number right below it.
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const isToday = (e) => new Date(e.ts || e.created_at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) === todayET;
    // 📋 Today's pre-market brief pins above the report (9:15 ET systems check).
    let briefHtml = '';
    try {
      const briefs = (await api.log('?limit=6&type=review.brief')).events || [];
      const brief = [...briefs].reverse().find(isToday);
      if (brief) {
        const bd = brief.data || {};
        const tape = bd.regime ? `<div class="report-summary">Tape: <b>${esc(bd.regime.key || '')}</b>${bd.regime.vix != null ? ` · VIX ${bd.regime.vix}` : ''}${bd.regime.read ? ` — ${esc(bd.regime.read)}` : ''}</div>` : '';
        const mktNews = bd.news?.market?.length ? `<div class="report-recs"><div class="faint" style="margin-bottom:2px">MARKET NEWS</div>${bd.news.market.slice(0, 5).map((h) => `<div>→ ${esc(h)}</div>`).join('')}</div>` : '';
        const symNews = bd.news && Object.keys(bd.news.symbols || {}).length ? `<div class="report-recs"><div class="faint" style="margin-bottom:2px">TRADED NAMES</div>${Object.entries(bd.news.symbols).slice(0, 6).map(([s, h]) => `<div><b>${esc(s)}</b> — ${esc(h)}</div>`).join('')}</div>` : '';
        briefHtml = `<div class="report-block"><div class="report-head"><b>📋 PRE-MARKET BRIEF</b><span class="faint">${new Date(brief.ts || brief.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div><div class="report-summary">${esc(String(brief.summary || '').replace(/^📋 PRE-MARKET BRIEF — /, ''))}</div>${tape}${mktNews}${symNews}</div>`;
      }
    } catch (_) {}
    const latestUnified = [...evs].reverse().find((e) => isToday(e) && e.data?.report);
    if (latestUnified) { host.innerHTML = briefHtml + unified(latestUnified); return; }
    const latestSmall = [...evs].reverse().find((e) => isToday(e) && (e.summary || '').startsWith('$1k BOOK'));
    const latestLab = [...evs].reverse().find((e) => isToday(e) && (e.summary || '').startsWith('LAB'));
    if (latestSmall || latestLab) {
      host.innerHTML = briefHtml
        + (latestSmall ? block('$1k BOOK', latestSmall.ts || latestSmall.created_at, latestSmall.summary, latestSmall.data?.review, latestSmall.data?.ai) : '')
        + (latestLab ? block('LAB', latestLab.ts || latestLab.created_at, latestLab.summary, latestLab.data?.review, latestLab.data?.ai) : '');
      return;
    }
    // No report yet today → live preview until the 5pm run lands.
    const [small, lab] = await Promise.all([api.review(24, 'small'), api.review(24, 'lab')]);
    const sv = small.review?.virtualEquity;
    host.innerHTML = briefHtml
      + block('$1k BOOK', null, sv ? `equity ${money(sv.equity, { dp: 2 })} (${sv.realizedPnl >= 0 ? '+' : ''}${money(sv.realizedPnl, { dp: 2 })} since ${sv.sinceDate})` : 'no data yet', small.review, null)
      + block('LAB', null, `${lab.review?.overall?.trades || 0} trades in 24h`, lab.review, null)
      + `<div class="acct-note">Live preview — the full graded report (with actions) lands at 5:00 PM ET.</div>`;
  } catch (_) { host.innerHTML = `<div class="empty-note">Reports unavailable.</div>`; }
}

// ── $1k small-account book card ────────────────────────────────────────────
async function loadBook() {
  const host = document.getElementById('pf-book');
  if (!host) return;
  let r;
  if (isSim()) {
    r = { virtualEquity: { startUsd: 1000, equity: 1078.4, realizedPnl: 78.4, trades: 9, sinceDate: '2026-07-07' }, overall: { trades: 4, winRate: 0.75, pnl: 31.2 } };
  } else {
    try { r = (await api.review(24, 'small')).review; }
    catch (_) { host.innerHTML = `<div class="empty-note">Book report unavailable.</div>`; return; }
  }
  const ve = r.virtualEquity, o = r.overall || {};
  if (!ve) { host.innerHTML = `<div class="empty-note">Small book not configured yet.</div>`; return; }
  const up = ve.realizedPnl >= 0;
  host.innerHTML = `
    <div class="acct-row big"><span>Book equity (started ${money(ve.startUsd, { dp: 0 })} on ${esc(ve.sinceDate)})</span><b class="mono ${up ? 'gain' : 'loss'}">${money(ve.equity, { dp: 2 })}</b></div>
    <div class="acct-row"><span>Compounded P&L · ${ve.trades} trade${ve.trades === 1 ? '' : 's'}</span><b class="mono ${up ? 'gain' : 'loss'}">${money(ve.realizedPnl, { sign: true, dp: 2 })}</b></div>
    <div class="acct-row"><span>Last 24h</span><b class="mono ${(o.pnl || 0) >= 0 ? 'gain' : 'loss'}">${o.trades || 0} trades · ${o.winRate != null ? Math.round(o.winRate * 100) + '% win · ' : ''}${money(o.pnl || 0, { sign: true, dp: 2 })}</b></div>
    <div class="acct-note">SPY/QQQ 0DTE calls &amp; puts (min 2 contracts, cap 30% of book, conviction-scaled) + crypto trend + equity scalps. All options flat by the close. Contracts grow as the book grows — this equity curve is the $1k real-account preview.</div>`;
}

async function loadBookAttribution(book) {
  const tbody = document.getElementById('pf-attr');
  if (!tbody) return;
  if (book === 'all') { load(document.querySelector('#pf-windows .fchip.on')?.getAttribute('data-w') || '1w'); return; }
  let r;
  if (isSim()) { r = { byStrategy: [{ key: 'zero_dte_momentum', trades: 6, winRate: 0.67, avgR: 0.8, pnl: 84.2 }] }; }
  else {
    try { r = (await api.review(168, book)).review; }
    catch (_) { tbody.innerHTML = `<tr><td colspan="5" class="empty-note">Report unavailable.</td></tr>`; return; }
  }
  const rows = (r.byStrategy || []).map((s) => ({ strategy_key: s.key, trades: s.trades, winRate: s.winRate, avgR: s.avgR, pnl: s.pnl }));
  paintAttribution(rows);
}

export function unmount() { plots.forEach((p) => p.destroy()); plots = []; }

async function load(windowKey) {
  let perf;
  if (isSim()) perf = simPerf(windowKey);
  else {
    try { perf = await api.performance(windowKey); }
    catch (_) { perf = { days: [], totals: {}, attribution: [] }; }
  }
  paintPods(perf.totals || {}, windowKey);
  paintAttribution(perf.attribution || []);
  paintCharts(perf.days || []);
}

// Three numbers, each labeled by WHAT it measures — no ambiguous P&L soup:
//   1. Account value (the truth, from the broker)
//   2. Today (equity vs this morning — includes open positions moving)
//   3. Closed trades in the selected window (why "performance" can differ from today)
function paintPods(t, windowKey = '1w') {
  const pods = document.getElementById('pf-pods');
  const h = state.hero || {};
  const chg = h.dayChangeUsd, pct = h.dayChangePct;
  const wr = t.winRate != null ? ` · ${Math.round(t.winRate * 100)}% win` : '';
  pods.innerHTML = [
    ['Account value', h.equity != null ? money(h.equity, { dp: 0 }) : '—', ''],
    ['Today (incl. open positions)', chg != null ? `${money(chg, { sign: true, dp: 0 })}${pct != null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''}` : '—', pnlClassSafe(chg)],
    [`Closed trades · ${windowKey}${t.trades != null ? ` · ${t.trades} trades${wr}` : ''}`, money(t.pnl || 0, { sign: true, dp: 0 }), pnlClassSafe(t.pnl)],
  ].map(([label, val, cls]) => `
    <div class="holo pod"><div class="pod-value mono ${cls}">${val}</div><div class="pod-sub">${label}</div></div>`).join('');
}
function pnlClassSafe(v) { return v == null ? '' : v >= 0 ? 'gain' : 'loss'; }

function paintAttribution(rows) {
  document.getElementById('pf-attr').innerHTML = rows.length ? rows.map((r) => `
    <tr><td><b>${esc(r.strategy_key || r.key)}</b></td><td>${r.trades}</td><td>${r.winRate != null ? Math.round(r.winRate * 100) + '%' : '—'}</td>
    <td>${r.avgR != null ? Number(r.avgR).toFixed(2) : '—'}</td><td class="${(r.pnl || 0) >= 0 ? 'gain' : 'loss'}">${money(r.pnl || 0, { sign: true, dp: 0 })}</td></tr>`).join('')
    : `<tr><td colspan="5" class="empty-note">No closed trades in this window.</td></tr>`;
}

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function paintCharts(days) {
  plots.forEach((p) => p.destroy());
  plots = [];
  if (!days.length || typeof window.uPlot !== 'function') return;

  const x = days.map((d) => new Date(d.trading_day).getTime() / 1000);
  const equity = days.map((d) => Number(d.equity_close ?? d.equity_open ?? 0));
  const daily = days.map((d) => Number(d.realized_pnl || 0));
  const axisStyle = {
    stroke: css('--text-faint'),
    grid: { stroke: 'rgba(63,63,70,.35)' },
    ticks: { stroke: 'rgba(63,63,70,.5)' },
    font: '11px "IBM Plex Mono"',
  };
  const base = (title) => ({
    width: Math.min(document.getElementById('pf-equity').clientWidth || 800, 1100),
    height: 220,
    legend: { show: false },
    cursor: { drag: { x: false, y: false } },
    scales: { x: { time: true } },
    axes: [axisStyle, { ...axisStyle, size: 64 }],
  });

  const eqEl = document.getElementById('pf-equity');
  plots.push(new window.uPlot({
    ...base('equity'),
    series: [{}, { stroke: css('--accent-hi'), width: 2, fill: 'rgba(34,211,238,.06)' }],
  }, [x, equity], eqEl));

  const dEl = document.getElementById('pf-daily');
  plots.push(new window.uPlot({
    ...base('daily'),
    series: [{}, {
      paths: window.uPlot.paths.bars({ size: [0.6, 100] }),
      points: { show: false },
      fill: 'rgba(53,196,106,.5)',
      stroke: css('--up'),
    }],
  }, [x, daily], dEl));
}

// ── Account reconciliation ─────────────────────────────────────────────────
// Walks inception → live broker equity so tracked stats and account reality
// can't silently diverge: the calendar/stats only sum TRACKED trades; losses
// from the July drift era (positions the broker held that ARC never booked,
// flattened during resets, plus crypto in-kind fees) live in "legacy".
async function loadAccount() {
  const host = document.getElementById('pf-account');
  if (!host) return;
  let a;
  if (isSim()) {
    a = { account: { equity: 24862.4 }, inception: 25000, sinceInception: -137.6, trackedRealizedTotal: 412.4, unrealizedOpen: 36, untrackedGap: -586 };
  } else {
    try { a = await api.pnlAudit(); }
    catch (_) { host.innerHTML = `<div class="empty-note">Reconciliation unavailable.</div>`; return; }
  }
  const row = (label, val, opts = {}) => {
    const cls = opts.neutral ? '' : (val >= 0 ? 'gain' : 'loss');
    return `<div class="acct-row${opts.big ? ' big' : ''}"><span>${label}</span><b class="mono ${cls}">${money(val, { sign: !opts.neutral, dp: 0 })}</b></div>`;
  };
  host.innerHTML = `
    ${row('Account equity (broker)', Number(a.account.equity), { neutral: true, big: true })}
    ${row(`Since inception (${money(a.inception, { dp: 0 })})`, Number(a.sinceInception), { big: true })}
    <div class="acct-split"></div>
    ${row('Trading P&L — tracked trades', Number(a.trackedRealizedTotal))}
    ${row('Open positions (mark to market)', Number(a.unrealizedOpen))}
    ${row('Legacy — July drift/reset era + crypto fees (not in trade stats)', Number(a.untrackedGap))}
    <div class="acct-note">Calendar &amp; strategy stats count tracked trades only. The legacy line is frozen history — drift is now auto-reconciled every 3 min.</div>`;
}

// ── Daily P&L calendar ─────────────────────────────────────────────────────
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

async function loadCalendar() {
  let days;
  if (isSim()) days = simCalendar();
  else { try { days = (await api.calendar(180)).days || []; } catch (_) { days = []; } }
  calData = new Map(days.map((d) => [String(d.trading_day).slice(0, 10), {
    pnl: Number(d.realized_pnl || 0), trades: Number(d.trades_closed || 0),
    wins: Number(d.wins || 0), losses: Number(d.losses || 0),
  }]));
  const now = new Date();
  calCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  renderCalendar();
}

function renderCalendar() {
  const host = document.getElementById('pf-calendar');
  if (!host || !calCursor) return;
  const year = calCursor.getFullYear(), month = calCursor.getMonth();
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = calCursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = ymd(new Date());

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell blank"></div>`;
  let monthPnl = 0, tradeDays = 0, winDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const rec = calData.get(ymd(new Date(year, month, day)));
    const today = ymd(new Date(year, month, day)) === todayStr ? ' today' : '';
    if (rec && rec.trades > 0) {
      monthPnl += rec.pnl; tradeDays++; if (rec.pnl > 0) winDays++;
      const cls = rec.pnl > 0 ? 'gain' : rec.pnl < 0 ? 'loss' : 'flat';
      cells += `<div class="cal-cell ${cls}${today}">
        <span class="cal-day">${day}</span>
        <span class="cal-pnl mono">${money(rec.pnl, { sign: true, dp: 0 })}</span>
        <span class="cal-trades">${rec.trades} trade${rec.trades === 1 ? '' : 's'}</span>
      </div>`;
    } else {
      cells += `<div class="cal-cell empty${today}"><span class="cal-day">${day}</span></div>`;
    }
  }

  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
  host.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav" data-cal="prev" aria-label="Previous month">&lsaquo;</button>
      <div class="cal-title">${monthName}</div>
      <button class="cal-nav" data-cal="next" aria-label="Next month">&rsaquo;</button>
    </div>
    <div class="cal-grid cal-dows">${dows}</div>
    <div class="cal-grid cal-days">${cells}</div>
    <div class="cal-foot">
      <span>Month <b class="mono ${monthPnl >= 0 ? 'gain' : 'loss'}">${money(monthPnl, { sign: true, dp: 0 })}</b></span>
      <span>Green days <b>${winDays}/${tradeDays}</b></span>
    </div>`;
  host.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => {
    calCursor.setMonth(calCursor.getMonth() + (b.getAttribute('data-cal') === 'next' ? 1 : -1));
    renderCalendar();
  }));
}

function simCalendar() {
  const days = [], today = new Date();
  for (let i = 75; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const pnl = +(Math.random() * 340 - 130).toFixed(2);
    const trades = 2 + Math.floor(Math.random() * 6);
    days.push({ trading_day: ymd(d), realized_pnl: pnl, trades_closed: trades, wins: pnl > 0 ? Math.ceil(trades * 0.7) : Math.floor(trades * 0.3), losses: 0 });
  }
  return days;
}

// Synthetic 3 weeks of performance for simulation mode.
function simPerf(windowKey) {
  const n = windowKey === '1d' ? 1 : windowKey === '1w' ? 5 : windowKey === '1m' ? 21 : 34;
  const days = [];
  let eq = 24500;
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const pnl = +(Math.random() * 260 - 90).toFixed(2);
    eq += pnl;
    days.push({ trading_day: d.toISOString().slice(0, 10), equity_open: eq - pnl, equity_close: eq, realized_pnl: pnl });
  }
  const pnl = +days.reduce((s, d) => s + d.realized_pnl, 0).toFixed(2);
  const wins = days.filter((d) => d.realized_pnl > 0).length;
  return {
    days,
    totals: { pnl, winRate: wins / Math.max(1, days.length), trades: days.length * 3, maxDrawdown: 190, profitFactor: 1.65 },
    attribution: [
      { strategy_key: 'ai_discretionary', trades: 14, winRate: 0.71, avgR: 0.9, pnl: 655.4 },
      { strategy_key: 'mean_reversion_bb', trades: 25, winRate: 0.68, avgR: 0.55, pnl: 412.55 },
      { strategy_key: 'momentum_breakout', trades: 31, winRate: 0.54, avgR: 0.4, pnl: 238.1 },
    ],
  };
}
