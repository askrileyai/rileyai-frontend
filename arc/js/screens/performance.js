// @ts-check
// PERFORMANCE — equity curve + daily P&L (uPlot), stat pods, attribution.

import { state } from '../store.js';
import { api, isSim } from '../api.js';
import { money, esc } from '../components/fmt.js';

let plots = [];

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
      <div class="holo"><div class="holo-label">Equity Curve</div><div class="uplot-wrap" id="pf-equity"></div></div>
      <div class="holo"><div class="holo-label">Daily P&L</div><div class="uplot-wrap" id="pf-daily"></div></div>
      <div class="holo">
        <div class="holo-label">Strategy Attribution</div>
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
  load('1w');
}

export function unmount() { plots.forEach((p) => p.destroy()); plots = []; }

async function load(windowKey) {
  let perf;
  if (isSim()) perf = simPerf(windowKey);
  else {
    try { perf = await api.performance(windowKey); }
    catch (_) { perf = { days: [], totals: {}, attribution: [] }; }
  }
  paintPods(perf.totals || {});
  paintAttribution(perf.attribution || []);
  paintCharts(perf.days || []);
}

function paintPods(t) {
  const pods = document.getElementById('pf-pods');
  const wr = t.winRate != null ? Math.round(t.winRate * 100) : null;
  pods.innerHTML = [
    ['Net P&L', money(t.pnl || 0, { sign: true, dp: 0 }), (t.pnl || 0) >= 0 ? 'gain' : 'loss'],
    ['Win Rate', wr != null ? wr + '%' : '—', ''],
    ['Trades', t.trades ?? '—', ''],
    ['Max Drawdown', t.maxDrawdown != null ? money(-Math.abs(t.maxDrawdown), { dp: 0 }) : '—', 'loss'],
    ['Profit Factor', t.profitFactor != null ? Number(t.profitFactor).toFixed(2) : '—', ''],
  ].map(([label, val, cls]) => `
    <div class="holo pod"><div class="pod-value mono ${cls}">${val}</div><div class="pod-sub">${label}</div></div>`).join('');
}

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
