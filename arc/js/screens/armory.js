// @ts-check
// SETTINGS — plain-language control. Riley's mandate (goal + autonomy + risk
// appetite), what Riley may trade (stocks/options/crypto/0DTE, options-first),
// guardrails (friendly, with an advanced expander), account/funding, danger.

import * as bus from '../bus.js';
import { state, RISK_PRESETS } from '../store.js';
import { api, isSim, API_BASE } from '../api.js';
import { esc, money } from '../components/fmt.js';

let unsubs = [];

const AUTONOMY = [
  ['manual', 'Manual', 'You direct every move through Riley chat.'],
  ['guided', 'Guided', "Riley runs only the strategies you've armed."],
  ['full', 'Full Auto', 'Riley hunts the market and trades on its own.'],
];
const APPETITE = [
  ['conservative', 'Conservative', 'Small size, tight caps, capital-first.'],
  ['balanced', 'Balanced', 'Moderate size and daily loss limit.'],
  ['aggressive', 'Aggressive', 'Bigger size, wider daily limit, more positions.'],
];
const ADVANCED = [
  ['maxPerTradeUsd', 'Max risk per trade ($)'],
  ['maxNotionalPerTradeUsd', 'Max notional per trade ($)'],
  ['maxOpenPositions', 'Max open positions'],
  ['maxDailyLossUsd', 'Daily loss cap ($)'],
  ['maxExposurePct', 'Max exposure (% equity)'],
  ['econBlackoutMinutes', 'Econ-event blackout (± min)'],
];

export function mount(host) {
  host.innerHTML = `<h1 style="margin-bottom:14px">Settings</h1><div class="settings" id="set"></div>`;
  render();
  unsubs = [bus.on('state', render)];
}
export function unmount() { unsubs.forEach((u) => u()); unsubs = []; }

function render() {
  const box = document.getElementById('set');
  if (!box) return;
  const m = state.mandate || {};
  const p = state.permissions || {};
  const rc = state.engine?.risk_config || {};
  box.innerHTML = `
    <div class="panel set-wide">
      <div class="panel-head">Riley's Mandate <span class="faint" style="font-weight:500;font-size:12px">tell Riley what you want; it configures + trades to hit it</span></div>
      <div class="panel-body">
        <label class="set-label">Your goal</label>
        <div class="row" style="gap:8px; margin-bottom:16px">
          <input id="m-goal" placeholder="e.g. make ~$400/week trading options, grow 5% this month, income not gambling" value="${esc(m.goal || '')}" style="flex:1">
          <button class="btn" id="m-goal-save">Set goal</button>
        </div>
        <label class="set-label">Autonomy</label>
        <div class="seg" id="m-auto">${AUTONOMY.map(([v, l, d]) => `<button data-v="${v}" class="${m.autonomy === v ? 'on' : ''}"><b>${l}</b><span>${d}</span></button>`).join('')}</div>
        <label class="set-label" style="margin-top:16px">Risk appetite</label>
        <div class="seg" id="m-risk">${APPETITE.map(([v, l, d]) => `<button data-v="${v}" class="${m.riskAppetite === v ? 'on' : ''}"><b>${l}</b><span>${d}</span></button>`).join('')}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">What Riley can trade</div>
      <div class="panel-body">
        ${permRow('stocks', 'Stocks & ETFs', 'Shares of any listed name.', p.stocks)}
        ${permRow('options', 'Options', 'Calls, puts, and spreads — defined-risk plays.', p.options)}
        <div id="opt-detail" ${p.options ? '' : 'hidden'} style="margin:2px 0 10px 14px; padding-left:12px; border-left:2px solid var(--border-hi)">
          <label class="set-label" style="margin-top:6px">Options approval level</label>
          <div class="seg small" id="opt-level">${[[1, 'Level 1 — covered'], [2, 'Level 2 — long calls/puts'], [3, 'Level 3 — spreads']].map(([v, l]) => `<button data-v="${v}" class="${(p.optionLevel || 2) == v ? 'on' : ''}">${l}</button>`).join('')}</div>
          ${permRow('zerodte', '0DTE options', 'Same-day expiry — extreme gamma. Hard flat-by-3:45pm + tight cap.', p.zerodte, true)}
        </div>
        ${permRow('crypto', 'Crypto', 'BTC/ETH and majors, 24/7.', p.crypto)}
        ${permRow('marketWide', 'Hunt the whole market', 'Let Riley scan beyond your watchlist for the best setups.', p.marketWide)}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Guardrails <span class="chip ${appetiteChip()}" style="text-transform:capitalize">${esc(m.riskAppetite || 'balanced')}</span></div>
      <div class="panel-body">
        <div class="guard-line"><span>Risk per trade</span><b>${money(rc.maxPerTradeUsd || 100, { dp: 0 })}</b></div>
        <div class="guard-line"><span>Pause the day if down</span><b>${money(rc.maxDailyLossUsd || 300, { dp: 0 })}</b></div>
        <div class="guard-line"><span>Most positions at once</span><b>${rc.maxOpenPositions || 5}</b></div>
        <div class="guard-line"><span>Pause around major news</span><b>Yes · ±${rc.econBlackoutMinutes || 15}m</b></div>
        <p class="faint" style="font-size:12px; margin-top:10px">These follow your risk appetite. Riley never exceeds them, and auto-halts if the daily cap is hit.</p>
        <button class="btn ghost" id="adv-toggle" style="margin-top:12px; min-height:34px">Advanced ▾</button>
        <div id="adv" hidden style="margin-top:12px">
          ${ADVANCED.map(([k, l]) => `<div class="risk-row"><label>${l}</label><input id="rk-${k}" type="number" value="${rc[k] ?? ''}"></div>`).join('')}
          <div class="risk-row"><label>PDT protection (under $25k)</label><label class="switch"><input type="checkbox" id="rk-pdt" ${rc.pdtProtection !== false ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label></div>
          <button class="btn" id="adv-save" style="margin-top:10px">Save advanced limits</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Account · Alpaca</div>
      <div class="panel-body">
        <div id="conn-box"><div class="empty-note">Checking uplink…</div></div>
        <div class="row" style="gap:8px; margin-top:12px">
          <button class="btn ghost" id="fund-dep" style="flex:1">Deposit</button>
          <button class="btn ghost" id="fund-wd" style="flex:1">Withdraw</button>
        </div>
        <div class="faint" style="font-size:11px; margin-top:8px; font-family:var(--font-mono)">API ${esc(API_BASE)}</div>
      </div>
    </div>

    <div class="panel set-wide">
      <div class="panel-head" style="color:var(--down)">Danger zone</div>
      <div class="panel-body">
        <div class="guard-line" style="border:none">
          <span><b style="color:var(--text)">LIVE TRADING</b><br><span class="faint" style="font-size:12px">Off = SHADOW/paper only. On = real orders once a strategy is also LIVE.</span></span>
          <label class="switch"><input type="checkbox" id="live-master" ${rc.liveTradingEnabled ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label>
        </div>
        <div class="row spread" style="margin-top:10px">
          <span class="dim" style="font-size:13px">Purge the key from this device.</span>
          <button class="btn danger" id="lock-btn" style="min-height:38px">Lock console</button>
        </div>
      </div>
    </div>
  `;
  wire(box);
  loadConnection();
}

function permRow(key, title, sub, on, nested = false) {
  return `<div class="perm-row" style="${nested ? 'padding-top:8px' : ''}">
    <div><div class="perm-title">${title}</div><div class="perm-sub">${sub}</div></div>
    <label class="switch"><input type="checkbox" data-perm="${key}" ${on ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></label>
  </div>`;
}
function appetiteChip() { return { conservative: 'up', balanced: 'live', aggressive: 'down' }[state.mandate?.riskAppetite] || 'live'; }

function wire(box) {
  box.querySelector('#m-goal-save').addEventListener('click', () => {
    state.mandate.goal = box.querySelector('#m-goal').value.trim() || null;
    persist(); toast('Goal set — Riley will trade toward it.');
  });
  box.querySelectorAll('#m-auto button').forEach((b) => b.addEventListener('click', () => {
    state.mandate.autonomy = b.getAttribute('data-v');
    if (state.mandate.autonomy === 'full') state.permissions.marketWide = true;
    persist(); render();
  }));
  box.querySelectorAll('#m-risk button').forEach((b) => b.addEventListener('click', () => {
    const v = b.getAttribute('data-v');
    state.mandate.riskAppetite = v;
    Object.assign(state.engine.risk_config, RISK_PRESETS[v] || {});
    persist(); render();
  }));
  box.querySelectorAll('[data-perm]').forEach((cb) => cb.addEventListener('change', () => {
    state.permissions[cb.getAttribute('data-perm')] = cb.checked;
    persist(); render();
  }));
  box.querySelectorAll('#opt-level button').forEach((b) => b.addEventListener('click', () => {
    state.permissions.optionLevel = Number(b.getAttribute('data-v'));
    persist(); render();
  }));
  box.querySelector('#adv-toggle').addEventListener('click', () => {
    const adv = box.querySelector('#adv'); adv.hidden = !adv.hidden;
    box.querySelector('#adv-toggle').textContent = adv.hidden ? 'Advanced ▾' : 'Advanced ▴';
  });
  box.querySelector('#adv-save')?.addEventListener('click', () => {
    for (const [k] of ADVANCED) { const v = Number(box.querySelector(`#rk-${k}`)?.value); if (Number.isFinite(v)) state.engine.risk_config[k] = v; }
    state.engine.risk_config.pdtProtection = box.querySelector('#rk-pdt').checked;
    persist(); toast('Advanced limits saved.');
  });
  box.querySelector('#fund-dep').addEventListener('click', () => toast('Deposit opens your Alpaca funding (wired in live mode).'));
  box.querySelector('#fund-wd').addEventListener('click', () => {
    const amt = window.prompt('Withdraw to bank — type the amount to confirm (this is irreversible):');
    if (amt) toast(`Withdrawal of ${amt} needs your typed confirmation in live mode.`);
  });
  box.querySelector('#live-master').addEventListener('change', (e) => {
    if (e.target.checked && !window.confirm('Arm LIVE trading?\n\nAny strategy set to LIVE will place REAL orders.')) { e.target.checked = false; return; }
    state.engine.risk_config.liveTradingEnabled = e.target.checked;
    persist();
  });
  box.querySelector('#lock-btn').addEventListener('click', async () => { const { lockConsole } = await import('../main.js'); lockConsole(); });
}

function persist() {
  bus.emit('state', state);
  if (!isSim()) {
    api.saveConfig({ risk_config: state.engine.risk_config, mandate: state.mandate, permissions: state.permissions }).catch(() => {});
  }
}

function toast(msg) {
  let t = document.getElementById('set-toast');
  if (!t) { t = document.createElement('div'); t.id = 'set-toast'; t.className = 'set-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
}

async function loadConnection() {
  const boxEl = document.getElementById('conn-box');
  if (!boxEl) return;
  let conn = state.connection;
  if (!isSim()) { try { conn = await api.connection(); } catch (_) { conn = null; } }
  if (!conn) { boxEl.innerHTML = `<div class="conn-pod"><div><div class="cp-name">Alpaca</div><div class="cp-sub">unreachable</div></div><span class="chip halted"><span class="dot"></span>DOWN</span></div>`; return; }
  const items = Array.isArray(conn.connections) ? conn.connections : [conn];
  boxEl.innerHTML = items.map((c) => `
    <div class="conn-pod">
      <div><div class="cp-name">${esc(c.brokerageName || c.brokerage_name || 'Alpaca')}</div>
      <div class="cp-sub">last sync ${c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleTimeString('en-US', { hour12: false }) : '—'}</div></div>
      <span class="chip ${c.connected === false || c.status === 'broken' ? 'halted' : 'live'}"><span class="dot"></span>${c.connected === false || c.status === 'broken' ? 'BROKEN' : 'LINKED'}</span>
    </div>`).join('');
}
