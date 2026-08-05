// @ts-check
// MISSION CONTROL — the decision console docked beside Riley's Mind.
//
// ARC makes three kinds of decision every tick and, until now, the dashboard
// showed none of them: the ARBITER picks which lane wins a setup, RILEY decides
// hold/ride/bank/cut, and the risk GATES run a 34-name ladder. This renders all
// three as always-visible channels so the reasoning behind a trade is legible
// while it happens (owner 08-04: "so i can see all aspects of how everything is
// working within the ARC").
//
// Visual direction is deliberately modern-futurist, NOT retro-HUD — an earlier
// pass with letterspaced neon captions, per-channel colours, corner brackets, a
// typewriter reveal and a sweep line was rejected as "80s scifi". What is left:
// the brain's own stage gradient as the surface, quiet sentence-case labels,
// hairline dividers, rows that settle rather than fly, and colour used ONLY for
// meaning (cleared green / held red). No box-shadow anywhere in this panel.
//
// Contract mirrors mountBrain() so bridge.js drives both the same way. It is
// FED by bridge (not self-subscribing) to keep unmount()'s single teardown path
// and to hold this module's imports to fmt.js, exactly like brain.js.

import { esc } from './fmt.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CH = ['arb', 'riley', 'gates'];
const LABEL = { arb: 'Arbiter', riley: 'Riley', gates: 'Gates' };
// Row caps sized so the panel never exceeds ~150 nodes: gates rows are the
// tallest (rail + fail line), riley the most numerous (one per decision).
const CAP = { arb: 14, riley: 16, gates: 10 };
const QCAP = 40;

const GREEN = 'rgba(52,211,153,.5)';
const RED = '#f87171';
const CYAN = 'rgba(34,211,238,.45)';

// Riley's action verbs, in her own plain language rather than shouty badges.
const ACT = {
  hold: 'holding', ride: 'riding', bank: 'banked', exit: 'cut',
  tighten: 'tightened the stop', scale: 'scaled out', scale_out: 'scaled out',
};
// Gauge colour follows the ACTION, which is the thing being judged.
const ACT_COLOR = { exit: 'rgba(248,113,113,.5)', bank: CYAN, scale: CYAN, scale_out: CYAN, tighten: CYAN };

/** The prose Riley wrote lives at the tail of `summary`, after the last em-dash
 *  separator. `data.reason` is a MACHINE ENUM ('riley_bank', 'riley_exit') and
 *  must never be rendered as rationale — that is the trap this helper exists to
 *  avoid. Falls back to the whole summary when there is no separator. */
function tail(summary) {
  const s = String(summary || '');
  const i = s.lastIndexOf(' — ');
  return i > 0 ? s.slice(i + 3) : s;
}

const fmtNum = (v) => (v == null || v === '' ? '' : String(v));

/**
 * @param {HTMLElement} host
 * @param {{onAsk?: (evt:object, sub:object|null)=>void}} [opts]
 *        onAsk fires when a row is clicked — that decision becomes the subject
 *        of the next question in the desk chat. `sub` is the individual
 *        riley.desk decision when the row came from data.decisions[].
 */
export function mountMission(host, opts) {
  host.innerHTML = `
    <div class="mission-panel">
      <div class="mn-head">
        <span class="mn-dot"></span>
        <span class="mn-title">Decisions</span>
        <span class="mn-clock" id="mn-clock">—</span>
      </div>
      <div class="mn-body">
        ${CH.map((k) => `
          <div class="mn-ch ch-${k}">
            <div class="mn-lab">${LABEL[k]}<span class="mn-strip" id="mn-strip-${k}"></span></div>
            ${k === 'gates' ? '<div class="mn-alarm" id="mn-alarm" hidden></div>' : ''}
            <div class="mn-list" id="mn-list-${k}"></div>
          </div>`).join('')}
      </div>
    </div>`;

  const lists = {}; CH.forEach((k) => { lists[k] = host.querySelector(`#mn-list-${k}`); });
  const strips = {}; CH.forEach((k) => { strips[k] = host.querySelector(`#mn-strip-${k}`); });
  const elClock = host.querySelector('#mn-clock');
  const elAlarm = host.querySelector('#mn-alarm');

  const Q = { arb: [], riley: [], gates: [] };
  // Dedupe: store.applyEvent only dedupes when evt.id != null, but LIVE events
  // arrive id:null+seq while REPLAYED ones carry a real id and no seq — so a
  // reconnect re-pushes the same logical event. decisionLog stamps `ts` once and
  // passes that same value to the INSERT, so ts is byte-identical across both
  // copies and is a reliable key. Date.parse normalises any ISO drift.
  const seen = new Map();
  const keyOf = (e) => `${e.type}|${Date.parse(e.ts) || 0}|${e.summary || ''}`;
  function fresh(evt) {
    const k = keyOf(evt);
    if (seen.has(k)) return false;
    seen.set(k, 1);
    if (seen.size > 400) seen.delete(seen.keys().next().value);
    return true;
  }

  // A queue item is { html, evt, sub } — the source event rides along so a click
  // can hand THAT decision to the desk chat.
  const norm = (rows, evt) => (rows || []).filter(Boolean)
    .map((r) => (typeof r === 'string' ? { html: r, sub: null, evt } : { html: r.html, sub: r.sub || null, evt }));

  function enqueue(ch, rows) {
    const q = Q[ch];
    for (const it of rows) { q.push(it); if (q.length > QCAP) q.shift(); }
  }

  function emit(ch, rows, animate) {
    const list = lists[ch]; if (!list || !rows.length) return;
    const frag = document.createDocumentFragment();
    // Queue is FIFO (oldest first) and we PREPEND, so append to the fragment in
    // reverse — the newest ends up on top with a single insertBefore.
    for (let i = rows.length - 1; i >= 0; i--) {
      const it = rows[i];
      const el = document.createElement('div');
      el.className = animate && !REDUCED ? 'mn-row' : 'mn-row mn-still';
      el.innerHTML = it.html;
      el.__evt = it.evt; el.__sub = it.sub;
      frag.appendChild(el);
    }
    list.insertBefore(frag, list.firstChild);
    while (list.children.length > CAP[ch]) list.removeChild(list.lastChild);
  }

  // One delegated listener for the whole panel — click a decision to ask Riley
  // about it. Rows carry their own event, so the question is about THAT
  // arbitration / veto / bank rather than a cold prompt.
  const onClick = (e) => {
    const row = e.target.closest('.mn-row');
    if (!row || !row.__evt || !opts?.onAsk) return;
    opts.onAsk(row.__evt, row.__sub);
  };
  host.addEventListener('click', onClick);

  function flush(all) {
    if (document.hidden) return;              // no DOM work behind a hidden tab
    let touched = false;
    for (const ch of CH) {
      const q = Q[ch]; if (!q.length) continue;
      // 1 row/tick reads as a considered feed; a burst drains 4; a flood dumps
      // everything with no animation so the open can't back the queue up.
      const n = all || q.length > 25 ? q.length : q.length > 8 ? 4 : 1;
      emit(ch, q.splice(0, n), !all && q.length <= 8);
      touched = true;
    }
    if (touched && elClock) {
      const d = new Date();
      elClock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
  }
  const flushT = setInterval(flush, 140);

  // Coming back from a hidden tab, drain EVERYTHING at once with no animation.
  // The queues are deliberately NOT cleared on hide: sse.js only disconnects
  // after 60s hidden, so a short tab-away produces no reconnect and therefore no
  // replay — dropping the queue would silently lose decisions the user never saw,
  // which is the one thing a decision log must not do. The 40/channel queue cap
  // plus the row caps bound how much can pile up.
  const onVis = () => { if (!document.hidden) flush(true); };
  document.addEventListener('visibilitychange', onVis);

  function route(evt) {
    const t = evt.type || '';
    const d = evt.data || {};
    const stage = d.stage || '';
    if (t === 'ai.arbitration' || t === 'arbiter.update') return { ch: 'arb', rows: arbRows(evt) };
    if (t === 'signal.rejected' && stage === 'arbiter') return { ch: 'arb', rows: [dim(`${evt.symbol || ''} lost the setup`)] };
    if (t === 'signal.rejected' && stage === 'desk_bias') return { ch: 'riley', rows: [rileyVeto(evt)] };
    if (t === 'riley.desk' || t === 'riley.desk.invalid' || t === 'riley.down') return { ch: 'riley', rows: deskRows(evt) };
    if (/^position\.(hold|ride|scale_out|trail|override|exit)$/.test(t)) return { ch: 'riley', rows: [posRow(evt)] };
    if (t === 'ai.analysis') return { ch: 'riley', rows: [dim(esc(evt.summary || ''))] };
    if (t === 'signal.accepted' || t === 'signal.rejected') return { ch: 'gates', rows: [gateRow(evt)] };
    if (t === 'risk.halt' || t === 'kill.activated' || t === 'kill.resumed') return { ch: 'gates', rows: [warn(esc(evt.summary || t))] };
    return null;
  }

  function push(evt) {
    if (!evt || !evt.type) return;
    if (evt.type === 'position.mark' || evt.type === 'heartbeat' || evt.type === 'engine.tick') return;
    if (!fresh(evt)) return;
    // The critical engine.diag means the day caps went UNENFORCED for a tick —
    // that is a banner, not a feed line. It is persisted, so it replays on
    // reconnect; only surface it if it is genuinely recent.
    if (evt.type === 'engine.diag' && evt.severity === 'critical') {
      if (Date.now() - (Date.parse(evt.ts) || 0) < 300000 && elAlarm) {
        elAlarm.textContent = 'Risk caps not enforced this tick';
        elAlarm.hidden = false;
      }
      return;
    }
    if (evt.type === 'signal.accepted' && elAlarm) elAlarm.hidden = true;
    // Riley's whole-desk note rides on the event, not the store — pin it beside
    // her label rather than spending a row on it.
    if (evt.type === 'riley.desk' && evt.data?.deskNote && strips.riley) {
      strips.riley.textContent = String(evt.data.deskNote).slice(0, 90);
    }
    const out = route(evt);
    if (out) { const rows = norm(out.rows, evt); if (rows.length) enqueue(out.ch, rows); }
  }

  return {
    push,
    /** Mount/replay path — walk the ring backwards so the newest lands on top,
     *  prime the dedupe map, and stop once every channel is full. No animation. */
    seed(events) {
      const arr = events || [];
      const full = () => CH.every((k) => lists[k].children.length >= CAP[k]);
      for (let i = arr.length - 1; i >= 0 && !full(); i--) {
        const evt = arr[i];
        if (!evt || !evt.type) continue;
        if (evt.type === 'position.mark' || evt.type === 'heartbeat' || evt.type === 'engine.tick') continue;
        if (!fresh(evt)) continue;
        const out = route(evt);
        if (!out) continue;
        const rows = norm(out.rows, evt);
        if (!rows.length) continue;
        const list = lists[out.ch];
        if (list.children.length >= CAP[out.ch]) continue;
        for (const it of rows) {
          if (list.children.length >= CAP[out.ch]) continue;
          const el = document.createElement('div');
          el.className = 'mn-row mn-still';
          el.innerHTML = it.html;
          el.__evt = it.evt; el.__sub = it.sub;
          list.appendChild(el);            // walking backwards → append keeps newest-first
        }
      }
    },
    update(d) {
      if (!d) return;
      if (strips.arb && d.regime) strips.arb.textContent = String(d.regime);
      if (strips.riley && d.deskNote) strips.riley.textContent = String(d.deskNote).slice(0, 90);
    },
    destroy() {
      clearInterval(flushT);
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('click', onClick);
      CH.forEach((k) => { Q[k].length = 0; });
      seen.clear();
    },
  };
}

// ── shared row primitives ───────────────────────────────────────────────────
function top(sym, act, meta, bad) {
  return `<div class="mn-top">${sym ? `<span class="mn-sym">${esc(sym)}</span>` : ''}`
    + `<span class="mn-act${bad ? ' bad' : ''}">${esc(act)}</span>`
    + `${meta ? `<span class="mn-meta">${esc(meta)}</span>` : ''}</div>`;
}
const note = (s, bad) => `<div class="mn-note${bad ? ' bad' : ''}">${esc(s)}</div>`;
const dim = (html) => `<div class="mn-top"><span class="mn-act dimmer">${html}</span></div>`;
const warn = (html) => `<div class="mn-top"><span class="mn-act bad">${html}</span></div>`;
const gauge = (v, col) => `<div class="mn-gauge"><i style="--w:${Math.max(0, Math.min(1, v))};background:${col}"></i></div>`;

// ── GATES ───────────────────────────────────────────────────────────────────
// data.gates is the real ladder: {name, pass, value, limit}. On ACCEPT it is the
// full green run; on REJECT it is the PREFIX ending at the failure, because
// evaluate() short-circuits. value/limit are PRE-FORMATTED DISPLAY STRINGS
// ('$1200', '< 3', 'open') — concatenate them, never run them through money().
function rail(gates) {
  const arr = gates.slice(0, 28);
  let h = '';
  arr.forEach((g, i) => {
    h += `<i style="--i:${i};background:${g && g.pass === false ? RED : GREEN}"></i>`;
  });
  return `<div class="mn-rail">${h}</div>`;
}

function gateRow(evt) {
  const d = evt.data || {};
  const gates = Array.isArray(d.gates) ? d.gates : null;
  const sym = evt.symbol || '';
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
  // Pre-ladder vetoes (sizing / regime_gate / bounce_resist / ai_gate) carry no
  // ladder at all — keep them visible as a one-liner rather than dropping them.
  const stage = d.stage || '';
  return top(sym, `${stage ? stage + ' · ' : ''}${failed}`, '', true);
}

// ── ARBITER ─────────────────────────────────────────────────────────────────
// ai.arbitration has FIVE payload shapes, not two. The ranked ladder arrives as
// data.scores[] on the merge path and data.contenders[] on the winner path —
// same semantics, two names.
function lane(name, w, isTop) {
  return `<div class="mn-ln"><span>${esc(name)}</span>`
    + `<span class="mn-gauge"><i style="--w:${w};background:${isTop ? '#22d3ee' : 'rgba(34,211,238,.28)'}"></i></span>`
    + `<span class="mn-lnv">${w.toFixed(2)}</span></div>`;
}

function ladder(ranked) {
  const arr = (ranked || []).filter(Boolean).slice(0, 4);
  if (!arr.length) return '';
  // Width is relative to the TOP score — score()'s absolute range is
  // unspecified, so never assume 0..1.
  const peak = Math.abs(Number(arr[0].score)) || 1;
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
      return [dim('weights rebalanced') + ladder(arr)];
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
// riley.desk -> data.decisions[] is the ONLY structured source of her prose
// reasoning + conviction. The per-position position.* events bury the reason in
// `summary` and put a machine enum in data.reason.
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
  // Each row carries ITS OWN decision so clicking it asks Riley about that
  // position specifically, not the whole desk pass.
  const rows = decs.slice(0, 4).map((dc) => ({ html: decRow(dc), sub: dc }));
  if (decs.length > 4) rows.push(dim(`+${decs.length - 4} more positions reviewed`));
  return rows;
}

function posRow(evt) {
  const d = evt.data || {};
  const t = evt.type || '';
  const conv = Number(d.conviction);
  let verb = t === 'position.hold' ? 'held through the stop'
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
