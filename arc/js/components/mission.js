// @ts-check
// MISSION CONTROL — the decision feed docked beside Riley's chat.
//
// v2 (08-05): ONE chronological feed, not three stacked scroll boxes. The
// three-channel layout failed on live traffic: each channel got ~150px of
// scroll, rows clipped mid-row at every boundary, and with no timestamps there
// was no way to tell what was new (owner: "dont know whats new entry, the
// scrolling is confusing"). Now every row carries its time + a channel tag,
// newest is always at the top of a single scroll area, and header chips filter
// to one channel when you want a single stream.
//
// Data contracts (verified against the backend, do not re-derive):
// - gates: signal.accepted carries the FULL ladder in data.gates; rejects carry
//   the PREFIX ending at the failure. value/limit are display strings.
// - arbiter: ai.arbitration has FIVE shapes (scores/contenders/signals/folded/
//   addCandidate). Bar widths are relative to the TOP score.
// - riley: riley.desk -> data.decisions[] is the only structured source of her
//   prose; position.* events carry prose in the summary TAIL and a machine enum
//   in data.reason.
//
// Click any row -> that decision loads into the desk chat (opts.onAsk).

import { esc } from './fmt.js';

// HH:MM:SS — fmt.js's tTime keeps milliseconds for the MIND terminal; here ms
// is noise on every row.
const rowTime = (ts) => { const d = new Date(ts); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CAP = 48;            // rows kept in the DOM (single list)
const QCAP = 60;           // queued rows before oldest are dropped
const TAG = { arb: 'Arbiter', riley: 'Riley', gates: 'Gates' };

const GREEN = 'rgba(52,211,153,.5)';
const RED = '#f87171';
const CYAN = 'rgba(34,211,238,.45)';

// Riley's action verbs, in her own plain language rather than shouty badges.
const ACT = {
  hold: 'holding', ride: 'riding', bank: 'banked', exit: 'cut',
  tighten: 'tightened the stop', scale: 'scaled out', scale_out: 'scaled out',
};
const ACT_COLOR = { exit: 'rgba(248,113,113,.5)', bank: CYAN, scale: CYAN, scale_out: CYAN, tighten: CYAN };

/** Riley's prose lives at the tail of `summary` after the last em-dash.
 *  data.reason is a MACHINE ENUM ('riley_bank') — never render it as rationale. */
function tail(summary) {
  const s = String(summary || '');
  const i = s.lastIndexOf(' — ');
  return i > 0 ? s.slice(i + 3) : s;
}

const fmtNum = (v) => (v == null || v === '' ? '' : String(v));

/**
 * @param {HTMLElement} host
 * @param {{onAsk?: (evt:object, sub:object|null)=>void}} [opts]
 */
export function mountMission(host, opts) {
  host.innerHTML = `
    <div class="mission-panel">
      <div class="mn-head">
        <span class="mn-dot"></span>
        <span class="mn-title">Decisions</span>
        <span class="mn-filters">
          <button class="mn-f on" data-f="">All</button>
          <button class="mn-f" data-f="arb">Arbiter</button>
          <button class="mn-f" data-f="riley">Riley</button>
          <button class="mn-f" data-f="gates">Gates</button>
        </span>
        <span class="mn-clock" id="mn-clock">—</span>
      </div>
      <div class="mn-note" id="mn-note" hidden></div>
      <div class="mn-alarm" id="mn-alarm" hidden></div>
      <div class="mn-list" id="mn-list"></div>
    </div>`;

  const panel = host.querySelector('.mission-panel');
  const list = host.querySelector('#mn-list');
  const elClock = host.querySelector('#mn-clock');
  const elNote = host.querySelector('#mn-note');
  const elAlarm = host.querySelector('#mn-alarm');

  // Channel filter — pure CSS show/hide via the panel's data-f attribute, so
  // switching filters never rebuilds rows.
  host.querySelector('.mn-filters').addEventListener('click', (e) => {
    const b = e.target.closest('.mn-f'); if (!b) return;
    host.querySelectorAll('.mn-f').forEach((x) => x.classList.toggle('on', x === b));
    const f = b.getAttribute('data-f');
    if (f) panel.setAttribute('data-f', f); else panel.removeAttribute('data-f');
  });

  const Q = [];                    // one queue: {ch, html, sub, evt}
  const lastSummary = {};          // per channel — suppress consecutive repeats

  // Dedupe across the SSE reconnect replay: live events arrive id:null+seq,
  // replayed ones carry a real id, so the store re-pushes the same logical
  // event. ts is stamped once server-side and survives the DB round-trip.
  const seen = new Map();
  const keyOf = (e) => `${e.type}|${Date.parse(e.ts) || 0}|${e.summary || ''}`;
  function fresh(evt) {
    const k = keyOf(evt);
    if (seen.has(k)) return false;
    seen.set(k, 1);
    if (seen.size > 400) seen.delete(seen.keys().next().value);
    return true;
  }

  function buildRow(it, animate) {
    const el = document.createElement('div');
    el.className = animate && !REDUCED ? 'mn-row' : 'mn-row mn-still';
    el.setAttribute('data-ch', it.ch);
    el.innerHTML = `<div class="mn-l"><span class="mn-time">${rowTime(it.evt.ts)}</span><span class="mn-tag">${TAG[it.ch]}</span></div><div class="mn-c">${it.html}</div>`;
    el.__evt = it.evt; el.__sub = it.sub;
    return el;
  }

  function emit(items, animate) {
    if (!items.length) return;
    const frag = document.createDocumentFragment();
    for (let i = items.length - 1; i >= 0; i--) frag.appendChild(buildRow(items[i], animate));
    list.insertBefore(frag, list.firstChild);
    while (list.children.length > CAP) list.removeChild(list.lastChild);
  }

  function flush(all) {
    if (document.hidden) return;
    if (!Q.length) return;
    const n = all || Q.length > 25 ? Q.length : Q.length > 8 ? 4 : 1;
    emit(Q.splice(0, n), !all && Q.length <= 8);
    if (elClock) {
      const d = new Date();
      elClock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
  }
  const flushT = setInterval(flush, 140);

  // Queues survive a hidden tab (sse only reconnects after 60s hidden, so a
  // short tab-away has no replay to recover from); on return everything drains
  // at once, unanimated.
  const onVis = () => { if (!document.hidden) flush(true); };
  document.addEventListener('visibilitychange', onVis);

  const onClick = (e) => {
    const row = e.target.closest('.mn-row');
    if (!row || !row.__evt || !opts?.onAsk) return;
    opts.onAsk(row.__evt, row.__sub);
  };
  host.addEventListener('click', onClick);

  function route(evt) {
    const t = evt.type || '';
    const d = evt.data || {};
    const stage = d.stage || '';
    if (t === 'ai.arbitration' || t === 'arbiter.update') return { ch: 'arb', rows: arbRows(evt) };
    if (t === 'signal.rejected' && stage === 'arbiter') return { ch: 'arb', rows: [dim(`${esc(evt.symbol || '')} lost the setup`)] };
    if (t === 'signal.rejected' && stage === 'desk_bias') return { ch: 'riley', rows: [rileyVeto(evt)] };
    if (t === 'riley.desk' || t === 'riley.desk.invalid' || t === 'riley.down') return { ch: 'riley', rows: deskRows(evt) };
    if (/^position\.(hold|ride|scale_out|trail|override|exit)$/.test(t)) return { ch: 'riley', rows: [posRow(evt)] };
    if (t === 'ai.analysis') return { ch: 'riley', rows: [dim(esc(evt.summary || ''))] };
    if (t === 'signal.accepted' || t === 'signal.rejected') return { ch: 'gates', rows: [gateRow(evt)] };
    if (t === 'risk.halt' || t === 'kill.activated' || t === 'kill.resumed') return { ch: 'gates', rows: [warn(esc(evt.summary || t))] };
    return null;
  }

  const norm = (rows, evt) => (rows || []).filter(Boolean)
    .map((r) => (typeof r === 'string' ? { html: r, sub: null, evt } : { html: r.html, sub: r.sub || null, evt }));

  function accept(evt) {
    if (!evt || !evt.type) return null;
    if (evt.type === 'position.mark' || evt.type === 'heartbeat' || evt.type === 'engine.tick') return null;
    if (!fresh(evt)) return null;
    if (evt.type === 'engine.diag' && evt.severity === 'critical') {
      if (Date.now() - (Date.parse(evt.ts) || 0) < 300000 && elAlarm) {
        elAlarm.textContent = 'Risk caps not enforced this tick';
        elAlarm.hidden = false;
      }
      return null;
    }
    if (evt.type === 'signal.accepted' && elAlarm) elAlarm.hidden = true;
    if (evt.type === 'riley.desk' && evt.data?.deskNote && elNote) {
      elNote.textContent = `Riley — ${String(evt.data.deskNote).slice(0, 120)}`;
      elNote.hidden = false;
    }
    const out = route(evt);
    if (!out) return null;
    // The desk re-emits near-identical reads every pass ("BoS retest pass: …").
    // Two of those back to back carry no information — keep the newest only.
    const rows = norm(out.rows, evt);
    if (!rows.length) return null;
    if (rows.length === 1 && lastSummary[out.ch] === rows[0].html) return null;
    lastSummary[out.ch] = rows.length === 1 ? rows[0].html : null;
    return { ch: out.ch, rows };
  }

  return {
    push(evt) {
      const out = accept(evt);
      if (!out) return;
      for (const r of out.rows) { Q.push({ ch: out.ch, ...r }); if (Q.length > QCAP) Q.shift(); }
    },
    /** Mount/replay path — newest first, no animation, dedupe primed. */
    seed(events) {
      const arr = events || [];
      for (let i = arr.length - 1; i >= 0 && list.children.length < CAP; i--) {
        const out = accept(arr[i]);
        if (!out) continue;
        for (const r of out.rows) {
          if (list.children.length >= CAP) break;
          list.appendChild(buildRow({ ch: out.ch, ...r }, false));   // walking backwards → append keeps newest-first
        }
      }
    },
    update(d) {
      if (!d) return;
      const reg = host.querySelector('#mn-clock');
      if (reg && d.regime) reg.setAttribute('title', String(d.regime));
    },
    destroy() {
      clearInterval(flushT);
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('click', onClick);
      Q.length = 0;
      seen.clear();
    },
  };
}

// ── row primitives ──────────────────────────────────────────────────────────
function top(sym, act, meta, bad) {
  return `<div class="mn-top">${sym ? `<span class="mn-sym">${esc(sym)}</span>` : ''}`
    + `<span class="mn-act${bad ? ' bad' : ''}">${esc(act)}</span>`
    + `${meta ? `<span class="mn-meta">${esc(meta)}</span>` : ''}</div>`;
}
const note = (s, bad) => `<div class="mn-note-t${bad ? ' bad' : ''}">${esc(s)}</div>`;
const dim = (html) => `<div class="mn-top"><span class="mn-act dimmer">${html}</span></div>`;
const warn = (html) => `<div class="mn-top"><span class="mn-act bad">${html}</span></div>`;
const gauge = (v, col) => `<div class="mn-gauge"><i style="--w:${Math.max(0, Math.min(1, v))};background:${col}"></i></div>`;

// ── GATES ───────────────────────────────────────────────────────────────────
function rail(gates) {
  const arr = gates.slice(0, 28);
  let h = '';
  arr.forEach((g, i) => { h += `<i style="--i:${i};background:${g && g.pass === false ? RED : GREEN}"></i>`; });
  return `<div class="mn-rail">${h}</div>`;
}

function gateRow(evt) {
  const d = evt.data || {};
  const gates = Array.isArray(d.gates) ? d.gates : null;
  // A Book C trade produces TWO gate rows — the paper twin and its real mirror.
  // Mark the live one; on a real-money dashboard that is THE distinction.
  const isReal = /_real$/.test(evt.strategyKey || '') || (d.stage === 'mirror_real');
  const sym = (evt.symbol || '') + (isReal ? ' 💰' : '');
  if (evt.type === 'signal.accepted') {
    if (!gates || !gates.length) return top(sym, 'cleared', '');
    return top(sym, 'cleared', `${gates.length} / ${gates.length}`) + rail(gates);
  }
  const failed = d.gate || (gates && gates.length ? gates[gates.length - 1]?.name : '') || 'a gate';
  if (gates && gates.length) {
    const g = gates[gates.length - 1] || {};
    const v = fmtNum(g.value), l = fmtNum(g.limit);
    return top(sym, `held at ${failed}`, `${gates.length}`, true)
      + rail(gates)
      + (v || l ? note(l ? `${v} · limit ${l}` : v) : '');
  }
  // Pre-ladder vetoes carry no ladder. stage and gate are often the SAME word
  // (stage 'bounce_resist', gate 'bounce_resist') — print it once, not twice.
  const stage = d.stage || '';
  const label = stage && stage !== failed ? `${stage} · ${failed}` : failed;
  return top(sym, `held — ${label}`, '', true);
}

// ── ARBITER ─────────────────────────────────────────────────────────────────
function lane(name, w, isTop) {
  return `<div class="mn-ln"><span>${esc(name)}</span>`
    + `<span class="mn-gauge"><i style="--w:${w};background:${isTop ? '#22d3ee' : 'rgba(34,211,238,.28)'}"></i></span>`
    + `<span class="mn-lnv">${w.toFixed(2)}</span></div>`;
}

function ladder(ranked) {
  const arr = (ranked || []).filter(Boolean).slice(0, 4);
  if (!arr.length) return '';
  const peak = Math.abs(Number(arr[0].score)) || 1;   // widths relative to the TOP score
  let h = arr.map((s, i) => lane(s.strategy || s.key || '?', Math.max(.04, Math.min(1, Math.abs(Number(s.score) || 0) / peak)), i === 0)).join('');
  const extra = (ranked || []).length - arr.length;
  if (extra > 0) h += `<div class="mn-ln more">+${extra} more</div>`;
  return h;
}

function arbRows(evt) {
  const d = evt.data || {};
  const sym = evt.symbol || '';
  if (evt.type === 'arbiter.update') {
    if (d.weights && typeof d.weights === 'object') {
      const arr = Object.entries(d.weights)
        .map(([k, v]) => ({ strategy: k, score: Number(v && v.weight) || 0 }))
        .filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
      if (!arr.length) return [dim('no enabled lanes')];
      return [dim('weights rebalanced') + ladder(arr.slice(0, 3))];
    }
    return [dim(esc(evt.summary || 'arbiter update'))];
  }
  const ranked = Array.isArray(d.scores) ? d.scores : (Array.isArray(d.contenders) ? d.contenders : null);
  if (ranked && ranked.length) {
    const conv = Array.isArray(d.scores);
    const head = conv
      ? top(sym, `${ranked.length} lanes converge`, `stack ${d.stack || ranked.length}`)
      : top(sym, `${d.winner || ranked[0].strategy} wins`, `${ranked.length} up`);
    return [head + ladder(ranked)];
  }
  if (Array.isArray(d.signals) && d.signals.length) {
    return [top(sym, 'stands aside — lanes disagree', `${d.signals.length}`, true)];
  }
  if (d.folded) return [dim(`${esc(sym)} folded into ${esc(String(d.winner || d.folded))}`)];
  if (d.addCandidate) return [dim(`${esc(sym)} add candidate`)];
  return [dim(esc(evt.summary || 'arbitration'))];
}

// ── RILEY ───────────────────────────────────────────────────────────────────
function decRow(dc) {
  const act = String(dc.action || '').toLowerCase();
  const verb = ACT[act] || act || 'reviewed';
  const conv = Number(dc.conviction);
  const col = ACT_COLOR[act] || GREEN;
  return top(dc.symbol || '', verb, Number.isFinite(conv) ? conv.toFixed(2) : '')
    + (dc.reason ? note(dc.reason) : '')
    + (Number.isFinite(conv) ? gauge(conv, col) : '');
}

function deskRows(evt) {
  const d = evt.data || {};
  if (evt.type === 'riley.down') return [warn(esc(evt.summary || 'Riley is unreachable'))];
  if (evt.type === 'riley.desk.invalid') return [dim(esc(evt.summary || 'decision dropped'))];
  const decs = Array.isArray(d.decisions) ? d.decisions : [];
  if (!decs.length) return [dim(esc(evt.summary || 'desk pass'))];
  // Each row carries its own decision so a click asks about THAT position.
  const rows = decs.slice(0, 4).map((dc) => ({ html: decRow(dc), sub: dc }));
  if (decs.length > 4) rows.push(dim(`+${decs.length - 4} more positions reviewed`));
  return rows;
}

function posRow(evt) {
  const d = evt.data || {};
  const t = evt.type || '';
  const conv = Number(d.conviction);
  const verb = t === 'position.hold' ? 'held through the stop'
    : t === 'position.ride' ? 'riding'
      : t === 'position.scale_out' ? 'scaled out'
        : t === 'position.trail' ? 'tightened the stop'
          : t === 'position.override' ? `overrode ${d.rule || 'the machine'}`
            : 'cut';
  const bad = t === 'position.exit';
  const meta = t === 'position.hold' && d.budget != null ? `${d.vetoesUsed || 1} / ${d.budget}`
    : (Number.isFinite(conv) ? conv.toFixed(2) : '');
  const col = bad ? 'rgba(248,113,113,.5)' : CYAN;
  return top(evt.symbol || '', verb, meta, bad)
    + note(tail(evt.summary))
    + (Number.isFinite(conv) ? gauge(conv, col) : '');
}

function rileyVeto(evt) {
  const d = evt.data || {};
  const conv = Number(d.conviction);
  return top(evt.symbol || '', 'vetoed the entry', Number.isFinite(conv) ? conv.toFixed(2) : '', true)
    + note(tail(evt.summary));
}
