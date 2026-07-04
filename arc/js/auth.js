// @ts-check
// The gate — ARC terminal authentication. Key round-trips against /status;
// success prints "ACCESS GRANTED", failure shakes. SIMULATION link runs the
// whole terminal on synthetic telemetry (no backend, no key). Pure data — no
// persona, no reactor.

import { api, setKey, getKey, setSim, isSim } from './api.js';

export function renderGate(onAuthed) {
  const gate = document.getElementById('gate');
  gate.hidden = false;
  gate.innerHTML = `
    <div class="gate-box">
      <div class="gate-head">
        <div class="gate-title">A.R.C.</div>
        <div class="gate-sub">AUTONOMOUS RILEYAI CAPITAL — TRADING TERMINAL</div>
        <input id="gate-key" type="password" placeholder="ACCESS KEY" autocomplete="current-password" spellcheck="false">
        <button class="btn" id="gate-go">AUTHENTICATE</button>
        <div class="gate-msg" id="gate-msg"></div>
      </div>
      <div class="gate-sim"><button id="gate-sim">LOAD SIMULATION SESSION →</button></div>
    </div>
  `;

  const input = gate.querySelector('#gate-key');
  const btn = gate.querySelector('#gate-go');
  const msg = gate.querySelector('#gate-msg');

  const typeOut = (text, cls = '') =>
    new Promise((resolve) => {
      msg.className = `gate-msg ${cls}`;
      msg.textContent = '';
      let i = 0;
      const t = setInterval(() => {
        msg.textContent = text.slice(0, ++i);
        if (i >= text.length) { clearInterval(t); resolve(); }
      }, 14);
    });

  const attempt = async () => {
    const key = input.value.trim();
    if (!key) { input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); return; }
    btn.disabled = true;
    setKey(key);
    setSim(false);
    msg.className = 'gate-msg';
    msg.textContent = 'authenticating…';
    try {
      await api.status();
      input.disabled = true;
      await typeOut('ACCESS GRANTED');
      setTimeout(() => { gate.hidden = true; onAuthed({ sim: false }); }, 380);
    } catch (e) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
      await typeOut(e.status === 401 || e.status === 403 ? 'ACCESS DENIED — invalid key' : `LINK FAILURE — ${e.message}`, 'err');
      input.value = '';
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });

  gate.querySelector('#gate-sim').addEventListener('click', async () => {
    setSim(true);
    input.disabled = true;
    btn.disabled = true;
    await typeOut('SIMULATION SESSION — SYNTHETIC TELEMETRY');
    setTimeout(() => { gate.hidden = true; onAuthed({ sim: true }); }, 340);
  });

  if (getKey() && !isSim()) input.value = '';
  setTimeout(() => input.focus(), 50);
}
