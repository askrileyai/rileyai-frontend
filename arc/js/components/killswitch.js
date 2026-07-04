// @ts-check
// Kill switch — hold-to-arm (1.2s progress ring), then an escalation sheet:
// L1 HALT / L2 CANCEL ALL / L3 FLATTEN (typed confirmation). Pointer-events
// so touch works; keyboard alternative (focus + hold Enter).

import { api, isSim } from '../api.js';
import { state } from '../store.js';
import { simKill } from '../sim.js';
import { esc } from './fmt.js';

const HOLD_MS = 1200;

// Flat terminal control: hold to arm; a red bar sweeps left→right as the
// fill, and at 100% opens the escalation sheet.
export function killSwitch() {
  const el = document.createElement('button');
  el.className = 'killswitch';
  el.setAttribute('aria-label', 'Kill switch — hold to arm');
  el.innerHTML = `<span class="ks-fill"></span><span class="ks-label">◼ KILL SWITCH — HOLD</span>`;
  const fill = el.querySelector('.ks-fill');

  let holdT0 = 0;
  let raf = 0;
  let armed = false;

  const setProgress = (p) => { fill.style.transform = `scaleX(${p})`; };

  const tick = () => {
    const p = Math.min(1, (Date.now() - holdT0) / HOLD_MS);
    setProgress(p);
    if (p >= 1) { armed = true; release(true); return; }
    raf = requestAnimationFrame(tick);
  };

  const press = () => {
    if (holdT0) return;
    holdT0 = Date.now();
    raf = requestAnimationFrame(tick);
  };

  const release = (fromComplete = false) => {
    cancelAnimationFrame(raf);
    holdT0 = 0;
    setProgress(0);
    if (armed || fromComplete) { armed = false; openSheet(); }
  };

  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); press(); });
  el.addEventListener('pointerup', () => release());
  el.addEventListener('pointercancel', () => { cancelAnimationFrame(raf); holdT0 = 0; setProgress(0); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) press(); });
  el.addEventListener('keyup', (e) => { if (e.key === 'Enter') release(); });

  return el;
}

function openSheet() {
  closeSheet();
  const veil = document.createElement('div');
  veil.className = 'sheet-veil';
  veil.id = 'ks-veil';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'ks-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.innerHTML = `
    <h2>‖ KILL SWITCH ARMED</h2>
    <p class="dim" style="font-size:12px">Select response level. Takes effect immediately.</p>
    <div class="sheet-actions">
      <button class="btn danger" data-level="1">L1 — HALT ENGINE <span class="dim" style="letter-spacing:0;text-transform:none">(no new entries; exits stay armed)</span></button>
      <button class="btn danger" data-level="2">L2 — HALT + CANCEL ALL ORDERS</button>
      <button class="btn danger" data-level="3">L3 — CANCEL + FLATTEN EVERYTHING</button>
      <div id="ks-flatten-confirm" hidden>
        <input id="ks-word" class="mono" placeholder='type FLATTEN to confirm' autocomplete="off" style="width:100%">
        <button class="btn danger" id="ks-flatten-go" disabled style="margin-top:8px">CONFIRM FLATTEN ALL</button>
      </div>
      <button class="btn ghost" id="ks-cancel">STAND DOWN</button>
    </div>
  `;
  document.body.append(veil, sheet);
  veil.addEventListener('click', closeSheet);
  sheet.querySelector('#ks-cancel').addEventListener('click', closeSheet);

  const fire = async (level) => {
    closeSheet();
    try {
      if (isSim()) simKill(level, 'manual (hud)');
      else await api.kill(level, 'manual (hud)');
    } catch (e) {
      alert(`Kill request failed: ${esc(e.message)} — try again.`);
    }
  };

  sheet.querySelectorAll('button[data-level]').forEach((b) => {
    b.addEventListener('click', () => {
      const level = Number(b.getAttribute('data-level'));
      if (level < 3) return fire(level);
      // L3 requires the typed word.
      const box = sheet.querySelector('#ks-flatten-confirm');
      box.hidden = false;
      const input = sheet.querySelector('#ks-word');
      const go = sheet.querySelector('#ks-flatten-go');
      input.focus();
      input.addEventListener('input', () => { go.disabled = input.value.trim().toUpperCase() !== 'FLATTEN'; });
      go.addEventListener('click', () => fire(3), { once: true });
    });
  });
}

function closeSheet() {
  document.getElementById('ks-veil')?.remove();
  document.getElementById('ks-sheet')?.remove();
}

export function engineStateLabel() {
  const s = state.engine?.state || 'OFF';
  return { OFF: 'OFFLINE', RUNNING: 'OPERATIONAL', HALTED_MANUAL: 'HALTED', HALTED_RISK: 'RISK HALT' }[s] || s;
}
