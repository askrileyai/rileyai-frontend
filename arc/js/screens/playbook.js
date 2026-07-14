// @ts-check
// STRATEGIES — Riley's signature 7-dimension engine + the playbook. Enable,
// set mode (SHADOW→LIVE), see stats. Custom strategies (formulated with Riley
// for any stock) can be added or deleted. One ruled row per strategy.

import * as bus from '../bus.js';
import { state } from '../store.js';
import { api, isSim } from '../api.js';
import { money, esc } from '../components/fmt.js';

let unsubs = [];
const lastSignal = {}; // strategyKey -> summary

export function mount(host) {
  host.innerHTML = `
    <div class="row spread" style="margin-bottom:12px">
      <h1>Strategies</h1>
      <button class="btn" id="pb-new">＋ New strategy — describe it to Riley</button>
    </div>

    <div class="panel" id="pb-flagship" style="overflow:hidden; margin-bottom:16px"></div>

    <div class="panel" style="overflow:hidden">
      <div class="panel-head">Playbook <span class="faint" style="font-weight:500;font-size:12px" id="pb-mission">Mission: every strategy &gt;50% win rate</span></div>
      <div style="overflow-x:auto">
        <table class="dtable playbook-tbl">
          <thead><tr>
            <th>On</th><th>Strategy</th><th>Status</th><th class="num">Last 20 · Win</th><th class="num">Exp $/tr</th><th class="num">P&L</th><th class="num">Trades</th><th>Mode</th><th></th>
          </tr></thead>
          <tbody id="pb"></tbody>
        </table>
      </div>
      <div class="empty-note" id="pb-empty" hidden>No strategies yet — ask Riley to build one.</div>
    </div>
  `;

  host.querySelector('#pb-new').addEventListener('click', () => {
    window.__arcChatPrefill = 'Formulate a new strategy for me — I want to trade ';
    location.hash = '#/riley';
  });

  paint();
  unsubs = [
    bus.on('state', paint),
    bus.on('evt', (evt) => {
      if (evt.strategyKey && /^signal\.|^order\.filled|^position\./.test(evt.type)) {
        lastSignal[evt.strategyKey] = `${new Date(evt.ts).toLocaleTimeString('en-US', { hour12: false })} · ${evt.summary}`;
      }
    }),
  ];
}

export function unmount() { unsubs.forEach((u) => u()); unsubs = []; }

function paint() {
  paintFlagship();
  const body = document.getElementById('pb');
  const empty = document.getElementById('pb-empty');
  if (!body) return;
  const rows = state.strategies.filter((s) => !s.flagship);
  empty.hidden = rows.length > 0;
  body.innerHTML = rows.map(rowHtml).join('');
  bind(body);
  // Mission line: how many armed strategies clear the >50% trailing-20 bar.
  const mission = document.getElementById('pb-mission');
  if (mission) {
    const armed = rows.filter((s) => s.enabled);
    const passing = armed.filter((s) => (s.trailing20?.n || 0) >= 5 && s.trailing20.winRate >= 0.5 && Number(s.trailing20.expectancy) > 0).length;
    mission.textContent = `Mission: every strategy >50% win rate — ${passing} of ${armed.length} armed are passing`;
  }
}

// Badge chip + trailing-20 win-rate bar vs the 50% line — the mission scoreboard.
const BADGE_STYLE = { PROMOTED: 'live', PROBATION: 'off', BENCHED: 'shadow', SUSPENDED: 'halted' };
function badgeChip(s) {
  if (!s.badge) return '';
  return `<span class="chip ${BADGE_STYLE[s.badge] || 'off'}" style="text-transform:none;font-size:10px">${esc(s.badge)}</span>`;
}
function wrBar(t20) {
  if (!t20 || !t20.n) return '<span class="dim">—</span>';
  const wr = Math.round((t20.winRate || 0) * 100);
  const col = t20.winRate >= 0.5 ? 'var(--up)' : 'var(--down)';
  return `<div style="display:inline-flex;align-items:center;gap:6px">
    <span class="${t20.winRate >= 0.5 ? 'up' : 'down'}" style="font-weight:700">${wr}%</span>
    <span style="position:relative;display:inline-block;width:54px;height:6px;background:var(--bg-4);border-radius:3px;overflow:visible">
      <span style="position:absolute;left:0;top:0;height:6px;width:${Math.min(100, wr)}%;background:${col};border-radius:3px"></span>
      <span style="position:absolute;left:50%;top:-2px;height:10px;width:1px;background:var(--text-faint)"></span>
    </span>
    <span class="faint" style="font-size:10px">${t20.n}tr</span>
  </div>`;
}

// The flagship hero card = the highest tested edge that's actually ARMED.
// (A disabled legacy flagship must not headline the playbook — since the
// 07-13 consolidation the desk is tested-edge-only, so the hero falls back
// to the best live benchmark, e.g. confluence_stack at 72.2%.)
function paintFlagship() {
  const box = document.getElementById('pb-flagship');
  const f = state.strategies.find((s) => s.flagship && s.enabled)
    || [...state.strategies].filter((s) => s.enabled && s.benchmark?.wr).sort((a, b) => (b.benchmark.wr || 0) - (a.benchmark.wr || 0))[0];
  if (!box) return;
  if (!f) { box.hidden = true; return; }
  box.hidden = false;
  const st = f.stats || {};
  box.innerHTML = `
    <div class="panel-head">
      <span class="row" style="gap:8px">${esc(f.name)} <span class="chip live" style="text-transform:none">${f.flagship ? "Riley's brain" : `Flagship · ${f.benchmark?.wr ? `tested ${f.benchmark.wr}%` : 'top edge'}`}</span></span>
      <label class="switch" title="enable/disable"><input type="checkbox" id="fl-en" ${f.enabled ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label>
    </div>
    <div class="panel-body">
      <div class="dim" style="font-size:13px; line-height:1.55; margin-bottom:12px">${esc(f.thesis)}</div>
      <div class="row" style="gap:6px; margin-bottom:12px">
        ${['Support / Resistance', 'Volume', 'Order Flow', 'Patterns', 'Structure', 'Momentum', 'RSI / MACD / Bollinger'].map((d) => `<span class="chip off" style="text-transform:none">${d}</span>`).join('')}
      </div>
      <div class="row spread">
        <div class="row" style="gap:22px; font-family:var(--font-mono); font-size:13px">
          <span>P&L <b class="${(st.pnl || 0) >= 0 ? 'up' : 'down'}">${money(st.pnl || 0, { sign: true, dp: 0 })}</b></span>
          <span class="dim">Win ${st.winRate != null ? Math.round(st.winRate * 100) + '%' : '—'}</span>
          <span class="dim">Trades ${st.trades ?? 0}</span>
        </div>
        <div class="mode-toggle" data-key="${esc(f.strategy_key)}"><button class="md-shadow ${f.mode !== 'LIVE' ? 'on-shadow' : ''}">SHADOW</button><button class="md-live ${f.mode === 'LIVE' ? 'on-live' : ''}">LIVE</button></div>
      </div>
    </div>
  `;
  box.querySelector('#fl-en').addEventListener('change', (e) => save(f.strategy_key, { enabled: e.target.checked }));
  bindModeToggle(box.querySelector('.mode-toggle'), f.strategy_key);
}

function rowHtml(s) {
  const st = s.stats || {};
  const t20 = s.trailing20 || null;
  const exp = t20 && t20.expectancy != null ? t20.expectancy : null;
  return `
  <tr data-key="${esc(s.strategy_key)}">
    <td><label class="switch" title="enable/disable"><input type="checkbox" class="st-enabled" ${s.enabled ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label></td>
    <td><span class="sym">${esc(s.name || s.strategy_key)}</span>${s.custom ? ' <span class="chip live" style="text-transform:none;font-size:9px">custom</span>' : ''}<div class="st-thesis">${esc(s.thesis || '')}</div></td>
    <td>${badgeChip(s)}</td>
    <td class="num">${wrBar(t20)}${s.benchmark?.wr ? `<div class="dim" style="font-size:10px" title="backtested win rate (${esc(s.benchmark.source || '')}, n=${s.benchmark.n ?? '?'})">test ${s.benchmark.wr}%</div>` : ''}</td>
    <td class="num ${exp != null ? (exp >= 0 ? 'up' : 'down') : 'dim'}">${exp != null ? money(exp, { sign: true, dp: 0 }) : '—'}</td>
    <td class="num ${(st.pnl || 0) >= 0 ? 'up' : 'down'}">${money(st.pnl || 0, { sign: true, dp: 0 })}</td>
    <td class="num">${st.trades ?? 0}</td>
    <td><div class="mode-toggle" data-key="${esc(s.strategy_key)}"><button class="md-shadow ${s.mode !== 'LIVE' ? 'on-shadow' : ''}">SHADOW</button><button class="md-live ${s.mode === 'LIVE' ? 'on-live' : ''}">LIVE</button></div></td>
    <td>${s.custom ? `<button class="btn ghost st-del" style="min-height:30px;padding:3px 10px;font-size:11px">Delete</button>` : ''}</td>
  </tr>`;
}

function bind(body) {
  body.querySelectorAll('tr[data-key]').forEach((row) => {
    const key = row.getAttribute('data-key');
    row.querySelector('.st-enabled').addEventListener('change', (e) => save(key, { enabled: e.target.checked }));
    bindModeToggle(row.querySelector('.mode-toggle'), key);
    row.querySelector('.st-del')?.addEventListener('click', () => remove(key));
  });
}

function bindModeToggle(el, key) {
  if (!el) return;
  const s = state.strategies.find((x) => x.strategy_key === key);
  el.querySelector('.md-shadow').addEventListener('click', () => { if (s.mode !== 'SHADOW') save(key, { mode: 'SHADOW' }); });
  el.querySelector('.md-live').addEventListener('click', () => {
    if (s.mode === 'LIVE') return;
    if (!window.confirm(`Arm ${s.name || key} for LIVE trading?\n\nReal orders will be placed once the global LIVE switch (Settings) is also on. Shadow-validate first.`)) return;
    save(key, { mode: 'LIVE' });
  });
}

async function save(key, patch) {
  const s = state.strategies.find((x) => x.strategy_key === key);
  if (!s) return;
  Object.assign(s, patch);
  paint();
  if (!isSim()) { try { await api.saveStrategy(key, patch); } catch (e) { alert(`Save failed: ${e.message}`); } }
  bus.emit('state', state);
}

async function remove(key) {
  const s = state.strategies.find((x) => x.strategy_key === key);
  if (!s || !window.confirm(`Delete "${s.name || key}"? This removes it from the engine.`)) return;
  state.strategies = state.strategies.filter((x) => x.strategy_key !== key);
  paint();
  if (!isSim()) { try { await api.saveStrategy(key, { deleted: true }); } catch (e) { alert(`Delete failed: ${e.message}`); } }
  bus.emit('state', state);
}
