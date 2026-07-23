// @ts-check
// Main — boot flow, hash router, shell bindings.
// Flow: gate → (boot sequence, once per session) → app shell + screens.

import * as bus from './bus.js';
import { getKey, isSim, clearKey, setSim } from './api.js';
import { state, hydrate, applyAlertTheme, thoughtRate } from './store.js';
import { renderGate } from './auth.js';
import * as sse from './sse.js';
import { startSim, stopSim } from './sim.js?v=m36';
import * as voice from './voice.js';
import { clockET, money } from './components/fmt.js';
import { engineStateLabel } from './components/killswitch.js';

// Screen imports carry their own cache-bust (07-14): main.js?v=mN alone does
// NOT re-fetch these — a phone could hold an old bridge.js against a new
// main.js and render a stale dashboard. Bump these with index.html's ?v.
import * as bridge from './screens/bridge.js?v=m38';
import * as riley from './screens/riley.js?v=m26';
import * as mind from './screens/mind.js?v=m26';
import * as playbook from './screens/playbook.js?v=m26';
import * as positions from './screens/positions.js?v=m36';
import * as performance from './screens/performance.js?v=m37';
import * as armory from './screens/armory.js?v=m26';

// Research retired (2026-07-07): it was the last screen on the synthetic data
// generator (rendered SPY "$474" while it traded $745) and duplicated what the
// Riley tab already does on real data. Old #/research links land on Riley.
const SCREENS = { bridge, riley, research: riley, mind, playbook, positions, performance, armory };
let current = null;
let currentName = '';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function route() {
  const name = (location.hash.replace(/^#\//, '') || 'bridge').split('?')[0];
  const target = SCREENS[name] ? name : 'bridge';
  if (target === currentName) return;
  const host = document.getElementById('screen');
  try { current?.unmount?.(); } catch (_) {}
  host.innerHTML = '';
  currentName = target;
  current = SCREENS[target];
  current.mount(host);
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-route') === target);
  });
  bus.emit('route', target);
  host.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Boot — terminal POST log (institutional; no persona)
// ---------------------------------------------------------------------------
const BOOT_LINES = [
  ['secure uplink', 'OK'],
  ['market data feed', 'LIVE'],
  ['risk protocols', 'ARMED'],
  ['strategy registry', '8 LOADED'],
  ['access', 'GRANTED'],
];

function playBoot() {
  return new Promise((resolve) => {
    const boot = document.getElementById('boot');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sessionStorage.getItem('arc_booted') || reduced) { resolve(); return; }
    boot.hidden = false;
    boot.innerHTML = `<div class="boot-lines" id="boot-lines"><div class="hdr">ARC TERMINAL v1.0.0 — AUTONOMOUS RILEYAI CAPITAL</div></div>`;
    const linesEl = boot.querySelector('#boot-lines');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sessionStorage.setItem('arc_booted', '1');
      boot.hidden = true;
      resolve();
    };
    boot.addEventListener('click', finish);

    let li = 0;
    const nextLine = () => {
      if (done) return;
      if (li >= BOOT_LINES.length) { setTimeout(finish, 650); return; }
      const [label, status] = BOOT_LINES[li++];
      const row = document.createElement('div');
      linesEl.appendChild(row);
      const dots = '.'.repeat(Math.max(3, 26 - label.length));
      row.innerHTML = `<span class="dim">&gt; ${label} ${dots} </span><span class="ok">${status}</span>`;
      setTimeout(nextLine, 260);
    };
    nextLine();
  });
}

// ---------------------------------------------------------------------------
// Shell bindings — status bar chips, clock, link dot
// ---------------------------------------------------------------------------
function bindShell() {
  const chip = document.getElementById('engine-chip');
  const clock = document.getElementById('market-clock');
  const equity = document.getElementById('sb-equity');
  const linkDot = document.getElementById('link-dot');

  const strip = document.getElementById('modestrip');
  const paint = () => {
    chip.textContent = engineStateLabel();
    chip.className = 'chip ' + (
      state.engine.state === 'RUNNING' ? (isLiveArmed() ? 'live' : 'shadow') :
      state.engine.state.startsWith('HALTED') ? 'halted' : 'off'
    );
    const eq = state.equity ?? state.balance?.cash;
    equity.textContent = eq != null ? money(eq, { dp: 0 }) : '';
    paintModeStrip(strip);
  };
  bus.on('state', paint);
  bus.on('alert', paint);
  bus.on('evt', (e) => { if (e.type.startsWith('engine.') || e.type.startsWith('kill.') || e.type === 'arbiter.update') paint(); });
  paint();

  bus.on('link', (s) => {
    linkDot.className = 'link-dot ' + (s === 'linked' ? '' : s === 'relink' ? 'relink' : 'offline');
    linkDot.title = `stream: ${s}`;
  });

  setInterval(() => { clock.textContent = clockET(); }, 1000);
  clock.textContent = clockET();

  bus.on('auth', ({ lost }) => { if (lost) lockConsole(); });
}

function isLiveArmed() {
  return state.engine?.risk_config?.liveTradingEnabled && state.strategies.some((s) => s.enabled && s.mode === 'LIVE');
}

// The persistent mode strip: telemetry, no persona. Reflects halt/shadow/live.
function paintModeStrip(strip) {
  if (!strip) return;
  const s = state.engine?.state || 'OFF';
  const mode = s.startsWith('HALTED') ? 'halted' : (s === 'RUNNING' && !isLiveArmed()) ? 'shadow' : 'none';
  strip.setAttribute('data-mode', mode);
  const active = state.strategies.filter((x) => x.enabled).length;
  const acct = state.simulated ? 'SIM · ALPACA' : (state.connection?.brokerageName || state.engine?.trading_account_id || 'NO BROKER');
  const segs = [];
  if (s.startsWith('HALTED')) segs.push(`‖ HALTED — ${escapeText(state.engine?.state_reason || 'manual')}`);
  else if (mode === 'shadow') segs.push('◈ SHADOW MODE — no live orders');
  else if (isLiveArmed()) segs.push('● LIVE TRADING ARMED');
  segs.push(`ENGINE <b>${s}</b>`);
  segs.push(`STRATEGIES <b>${active}</b>`);
  segs.push(`ACCOUNT <b>${acct}</b>`);
  if (state.simulated) segs.push('DATA <b>SYNTHETIC</b>');
  strip.innerHTML = segs.map((t) => `<span class="ms-seg">${t}</span>`).join('<span class="faint">·</span>');
}

function escapeText(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

export function lockConsole() {
  sse.stop();
  stopSim();
  setSim(false);
  clearKey();
  sessionStorage.removeItem('arc_booted');
  document.getElementById('app').hidden = true;
  renderGate(enter);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
async function enter({ sim }) {
  await playBoot();
  document.getElementById('app').hidden = false;
  if (sim) {
    startSim();
  } else {
    try { await hydrate(); } catch (_) {}
    sse.start();
  }
  applyAlertTheme();
  route();
}

window.addEventListener('hashchange', route);
voice.init();
bindShell();

if (isSim() || getKey()) {
  // Returning session — skip the gate, go straight in (key revalidates on first call).
  enter({ sim: isSim() });
} else {
  renderGate(enter);
}
