// @ts-check
// RESEARCH — stock lookup + watchlist + Riley's live read. Search any ticker;
// see what it's doing right now (price, key levels, volume, RSI, momentum) and
// Riley's 7-dimension take with a suggested play. Real mode pulls the backend
// analysis; sim generates a plausible, deterministic read per symbol.

import { state } from '../store.js';
import * as bus from '../bus.js';
import { isSim } from '../api.js';
import { money, pnlClass, esc } from '../components/fmt.js';
import { readFor, bestIdeas } from '../analysis.js';

let unsubs = [];
let current = null;

export function mount(host) {
  host.innerHTML = `
    <div class="research">
      <div class="rs-left">
        <div class="panel" style="overflow:hidden">
          <div class="panel-head">Look up a stock</div>
          <div class="panel-body">
            <div class="row" style="gap:8px">
              <input id="rs-q" placeholder="Ticker (e.g. TSLA)" maxlength="6" spellcheck="false" style="flex:1; text-transform:uppercase">
              <button class="btn" id="rs-go">Analyze</button>
            </div>
          </div>
        </div>
        <div class="panel" style="overflow:hidden; margin-top:16px">
          <div class="panel-head">Watchlist <button class="btn ghost" id="rs-add" style="min-height:28px;padding:2px 10px;font-size:11px">＋ Add</button></div>
          <div id="rs-watch"></div>
        </div>
      </div>
      <div class="rs-main" id="rs-main"></div>
    </div>
    <div class="panel" id="rs-ideas" style="overflow:hidden; margin-top:16px"></div>
  `;
  const q = host.querySelector('#rs-q');
  const go = () => { const s = q.value.trim().toUpperCase(); if (s) select(s); };
  host.querySelector('#rs-go').addEventListener('click', go);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  host.querySelector('#rs-add').addEventListener('click', () => {
    const s = window.prompt('Add a ticker to your watchlist:');
    if (s && s.trim()) { const t = s.trim().toUpperCase(); if (!state.watchlist.includes(t)) { state.watchlist.push(t); bus.emit('state', state); paintWatch(); } }
  });

  paintWatch();
  paintIdeas();
  select(current || state.watchlist[0] || 'SPY');
  unsubs = [bus.on('state', () => { paintWatch(); paintIdeas(); })];
}
export function unmount() { unsubs.forEach((u) => u()); unsubs = []; }

function paintWatch() {
  const box = document.querySelector('#rs-watch');
  if (!box) return;
  if (!state.watchlist.length) { box.innerHTML = `<div class="empty-note">Empty — add a ticker.</div>`; return; }
  box.innerHTML = state.watchlist.map((sym) => {
    const d = readFor(sym);
    return `<div class="wl-row ${sym === current ? 'on' : ''}" data-sym="${sym}">
      <div><div class="wl-sym">${esc(sym)}</div><div class="wl-read ${d.biasCls}">${d.biasLabel}</div></div>
      <div style="text-align:right"><div class="wl-px mono">${money(d.price)}</div><div class="wl-chg mono ${pnlClass(d.chg)}">${d.chg >= 0 ? '+' : ''}${d.chgPct.toFixed(2)}%</div></div>
    </div>`;
  }).join('');
  box.querySelectorAll('.wl-row').forEach((r) => {
    r.addEventListener('click', () => select(r.getAttribute('data-sym')));
    const rm = document.createElement('button');
  });
}

function select(sym) {
  current = sym;
  paintWatch();
  const d = readFor(sym);
  const main = document.querySelector('#rs-main');
  if (!main) return;
  const canOpt = state.permissions?.options;
  main.innerHTML = `
    <div class="panel" style="overflow:hidden">
      <div class="panel-head">${esc(sym)} — live read <span class="chip ${d.biasCls}">${d.biasLabel}</span></div>
      <div class="panel-body">
        <div class="rs-quote">
          <div class="rs-px mono">${money(d.price)}</div>
          <div class="rs-chg mono ${pnlClass(d.chg)}">${d.chg >= 0 ? '+' : ''}${money(d.chg)} (${d.chg >= 0 ? '+' : ''}${d.chgPct.toFixed(2)}%)</div>
          <div class="faint" style="font-size:12px; margin-left:auto">Vol ${d.volX}× avg · RSI ${d.rsi} · ${d.trend}</div>
        </div>
        <div class="rs-say">${esc(d.say)}</div>
        <div class="rs-dims">
          ${dim('Support', money(d.support), d.nearSupport ? 'near' : '')}
          ${dim('Resistance', money(d.resistance), d.nearResist ? 'near' : '')}
          ${dim('Volume', d.volX + '× avg', d.volX >= 1.5 ? 'hot' : '')}
          ${dim('RSI', String(d.rsi), d.rsi < 32 || d.rsi > 70 ? 'hot' : '')}
          ${dim('Momentum', d.mom, '')}
          ${dim('Structure', d.struct, '')}
        </div>
        <div class="rs-play">
          <div class="rs-play-head">Riley's play</div>
          <div class="rs-play-body">${esc(d.play)}${canOpt && d.optionPlay ? `<div class="rs-opt">Options: ${esc(d.optionPlay)}</div>` : ''}</div>
          <div class="row" style="gap:8px; margin-top:12px">
            <button class="btn" id="rs-trade">Have Riley trade this</button>
            <button class="btn ghost" id="rs-strat">Build a strategy for ${esc(sym)}</button>
          </div>
        </div>
      </div>
    </div>
  `;
  main.querySelector('#rs-trade').addEventListener('click', () => {
    window.__arcChatPrefill = `Take the ${sym} setup you're seeing — ${d.play}`;
    location.hash = '#/riley';
  });
  main.querySelector('#rs-strat').addEventListener('click', () => {
    window.__arcChatPrefill = `Formulate a strategy for ${sym}`;
    location.hash = '#/riley';
  });
}

function dim(label, val, flag) {
  return `<div class="rs-dim ${flag ? 'flag-' + flag : ''}"><div class="rs-dim-l">${label}</div><div class="rs-dim-v mono">${val}</div></div>`;
}

// Riley's Best Ideas — hedge-fund-grade structures ranked by conviction.
function paintIdeas() {
  const box = document.querySelector('#rs-ideas');
  if (!box) return;
  const ideas = bestIdeas(state.watchlist, 4);
  box.innerHTML = `
    <div class="panel-head">Riley's Best Ideas <span class="faint" style="font-weight:500;font-size:12px">institutional structures, ranked by conviction</span></div>
    <div class="ideas-grid">
      ${ideas.map((i) => `
        <div class="idea">
          <div class="idea-top"><span class="idea-name">${esc(i.symbol)} · ${esc(i.name)}</span><span class="chip live" style="text-transform:none">${Math.round(i.conviction * 100)}%</span></div>
          <div class="idea-tag">${esc(i.tag)}</div>
          <div class="idea-thesis">${esc(i.thesis)}</div>
          <div class="idea-struct"><b>Structure:</b> ${esc(i.structure)}</div>
          <div class="idea-rr"><b>Risk/Reward:</b> ${esc(i.riskReward)}</div>
          <button class="btn" data-deploy="${esc(i.symbol)}|${esc(i.name)}" style="margin-top:10px; min-height:36px; width:100%">Deploy with Riley</button>
        </div>`).join('')}
    </div>
  `;
  box.querySelectorAll('[data-deploy]').forEach((b) => b.addEventListener('click', () => {
    const [sym, name] = b.getAttribute('data-deploy').split('|');
    window.__arcChatPrefill = `Deploy the ${name} on ${sym} you're recommending — set it up and run it.`;
    location.hash = '#/riley';
  }));
}
