// @ts-check
// MIND — the star feature. Live decision terminal: color-coded event rows,
// expandable JSON payloads, filters, auto-scroll with pause, thought-rate.

import * as bus from '../bus.js';
import { state, thoughtRate } from '../store.js';
import { tTime, esc } from '../components/fmt.js';

const TYPE_CLASS = [
  [/^strategy\.scan|^heartbeat|^engine\.tick|^market\./, 't-scan'],
  [/^signal\.rejected/, 't-veto'],
  [/^signal\./, 't-signal'],
  [/^order\.(canceled|rejected|unknown)/, 't-veto'],
  [/^order\.(filled)|^position\.opened/, 't-fill'],
  [/^order\./, 't-order'],
  [/^position\.closed/, 't-order'],
  [/^ai\.|^arbiter\.|^regime\./, 't-ai'],
  [/^kill\.|^risk\.halt|^error/, 't-halt'],
  [/.*/, 't-info'],
];

const BADGES = {
  'strategy.scan': 'scan', 'signal.new': 'signal', 'signal.accepted': 'approved', 'signal.rejected': '▲ veto',
  'order.submitting': 'order', 'order.placed': 'order', 'order.filled': '● fill', 'order.canceled': 'cancel',
  'order.rejected': 'reject', 'order.unknown': '?! unknown', 'position.opened': '● open', 'position.closed': 'closed',
  'position.mark': 'mark', 'ai.analysis': 'arc', 'ai.arbitration': 'arbiter', 'arbiter.update': 'arbiter',
  'regime.update': 'regime', 'risk.halt': '■ halt', 'kill.activated': '■ KILL', 'kill.resumed': 'resume',
  'engine.start': 'engine', 'engine.state': 'engine', 'error': 'error', 'heartbeat': '·',
};

let unsubs = [];
let pinned = true;
let typeFilters = new Set();  // empty = all
let stratFilter = '';
let textFilter = '';
let pendingCount = 0;

const rowClass = (t) => TYPE_CLASS.find(([re]) => re.test(t))[1];

export function mount(host) {
  host.innerHTML = `
    <div class="mind">
      <div class="mind-head">
        <div class="row">
          <h1>The Mind</h1>
          <div class="thought-rate"><span class="tr-bars" id="m-bars">${'<i></i>'.repeat(20)}</span><span id="m-rate">0 THOUGHTS/MIN</span></div>
        </div>
        <div class="filters" id="m-filters">
          ${['signals', 'orders', 'positions', 'ai', 'risk', 'noise'].map((f) => `<button class="fchip" data-f="${f}">${f}</button>`).join('')}
          <select id="m-strat"><option value="">all strategies</option></select>
          <input id="m-text" placeholder="grep…" style="min-height:30px;padding:4px 10px;font-size:.7rem;width:110px">
        </div>
      </div>
      <div class="mind-term-wrap">
        <div class="terminal" id="m-term" role="log" aria-live="off"></div>
        <button class="resume-pill" id="m-resume" hidden>▼ RESUME FEED</button>
      </div>
    </div>
  `;

  const term = host.querySelector('#m-term');
  const strat = host.querySelector('#m-strat');
  const seen = new Set(state.strategies.map((s) => s.strategy_key));
  for (const k of seen) strat.appendChild(new Option(k, k));

  // replay the ring buffer
  for (const evt of state.events) appendRow(term, evt, true);
  scrollToEnd(term);

  // filter interactions
  host.querySelectorAll('.fchip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const f = chip.getAttribute('data-f');
      if (typeFilters.has(f)) { typeFilters.delete(f); chip.classList.remove('on'); }
      else { typeFilters.add(f); chip.classList.add('on'); }
      rerender(term);
    });
  });
  strat.addEventListener('change', () => { stratFilter = strat.value; rerender(term); });
  host.querySelector('#m-text').addEventListener('input', (e) => { textFilter = e.target.value.toLowerCase(); rerender(term); });

  // scroll pinning
  term.addEventListener('scroll', () => {
    const atEnd = term.scrollTop + term.clientHeight >= term.scrollHeight - 40;
    if (atEnd) { pinned = true; pendingCount = 0; updateResume(); }
    else pinned = false;
  });
  host.querySelector('#m-resume').addEventListener('click', () => { pinned = true; pendingCount = 0; scrollToEnd(term); updateResume(); });

  unsubs = [
    bus.on('evt', (evt) => {
      appendRow(term, evt);
      if (pinned) scrollToEnd(term);
      else { pendingCount++; updateResume(); }
      paintRate();
    }),
  ];
  paintRate();
  const rateT = setInterval(paintRate, 2000);
  unsubs.push(() => clearInterval(rateT));
}

export function unmount() { unsubs.forEach((u) => u()); unsubs = []; pinned = true; }

function groupOf(type) {
  if (/^signal\./.test(type)) return 'signals';
  if (/^order\./.test(type)) return 'orders';
  if (/^position\./.test(type)) return 'positions';
  if (/^ai\.|^arbiter\.|^regime\./.test(type)) return 'ai';
  if (/^kill\.|^risk\./.test(type)) return 'risk';
  return 'noise';
}

function passes(evt) {
  if (typeFilters.size && !typeFilters.has(groupOf(evt.type))) return false;
  if (stratFilter && evt.strategyKey !== stratFilter) return false;
  if (textFilter && !`${evt.summary} ${evt.symbol || ''}`.toLowerCase().includes(textFilter)) return false;
  return true;
}

function appendRow(term, evt, replay = false) {
  if (!passes(evt)) return;
  const row = document.createElement('div');
  row.className = `t-row ${rowClass(evt.type)}`;
  const badge = BADGES[evt.type] || evt.type;
  const hasData = evt.data && Object.keys(evt.data).length;
  row.innerHTML = `
    <span class="t-time">${tTime(evt.ts)}</span><span class="t-badge">${esc(badge)}</span>${
    hasData
      ? `<details><summary>${esc(evt.summary)}</summary><span class="t-json">${esc(JSON.stringify(evt.data, null, 2))}</span></details>`
      : esc(evt.summary)
    }${evt.strategyKey ? `<span class="t-strat">[${esc(evt.strategyKey)}]</span>` : ''}`;
  term.appendChild(row);
  while (term.children.length > 500) term.removeChild(term.firstChild);
}

function rerender(term) {
  term.innerHTML = '';
  for (const evt of state.events) appendRow(term, evt, true);
  scrollToEnd(term);
  pinned = true; pendingCount = 0; updateResume();
}

function scrollToEnd(term) { term.scrollTop = term.scrollHeight; }

function updateResume() {
  const pill = document.getElementById('m-resume');
  if (!pill) return;
  pill.hidden = pinned;
  pill.textContent = `▼ RESUME FEED${pendingCount ? ` (${pendingCount} new)` : ''}`;
}

function paintRate() {
  const rate = thoughtRate();
  const rateEl = document.getElementById('m-rate');
  const bars = document.getElementById('m-bars');
  if (rateEl) rateEl.textContent = `${rate} THOUGHTS/MIN`;
  if (bars) {
    const lit = Math.min(20, Math.round(rate / 3));
    [...bars.children].forEach((b, i) => {
      b.className = i < Math.max(1, lit) ? 'on' : '';
      b.style.height = `${5 + i * 0.65}px`;
    });
  }
}
