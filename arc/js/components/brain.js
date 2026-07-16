// @ts-check
// THE ARC — RILEY'S MIND. A live neural-brain visualization that replaces the
// equity chart under the account cards. Neurons fire at a rate driven by real
// engine activity; colored pulses fire on real events (green entry · gold bank
// · red cut · cyan read); a live readout shows what she's watching/managing and
// a "current trade — what she's thinking" stream narrates the open position.
// mountBrain(host) sets up the canvas + animation ONCE and returns a controller
// { update(data), pulse(type), destroy() } — bridge drives it, no re-mount.

import { money, esc } from './fmt.js';

const DW = 1000, DH = 520;                 // design space
const CX = 500, CY = 265, A = 350, B = 218; // top-down brain ellipse
const COLORS = { read: '#22d3ee', entry: '#22c55e', bank: '#eab308', cut: '#ef4444' };

// Map a live engine event type → a pulse color (null = ignore).
export function pulseTypeFor(t) {
  t = String(t || '');
  if (/^position\.(opened|entry)|^order\.(filled|submitted)|^signal\.accepted/.test(t)) return 'entry';
  if (/scale_out|riley_bank|peak_bank|profit_protect|^position\.closed/.test(t)) return 'bank';
  if (/stop|loss_floor|theta|risk\.halt|scratch|cut/.test(t)) return 'cut';
  if (/^position\.(trail|ride|mark)|^ai\.|desk|tape|scan|signal\./.test(t)) return 'read';
  return 'read';
}

export function mountBrain(host) {
  host.innerHTML = `
    <div class="brain-panel">
      <div class="brain-head">
        <div class="bh-l"><span class="bh-dot"></span>THE&nbsp;ARC <span class="bh-sub">— RILEY'S MIND</span></div>
        <div class="bh-r" id="brain-state"><span class="bh-pulse"></span>—</div>
      </div>
      <div class="brain-readout" id="brain-readout"></div>
      <div class="brain-stage">
        <canvas id="brain-cv"></canvas>
        <div class="brain-legend">
          <span><i style="color:#22c55e;background:#22c55e"></i>entry</span>
          <span><i style="color:#eab308;background:#eab308"></i>bank</span>
          <span><i style="color:#ef4444;background:#ef4444"></i>cut</span>
          <span><i style="color:#22d3ee;background:#22d3ee"></i>read</span>
        </div>
      </div>
      <div class="brain-think" id="brain-think"><span class="bt-dot"></span><span class="bt-body" id="brain-think-body">Waking up…</span></div>
    </div>`;

  const cv = host.querySelector('#brain-cv');
  const ctx = cv.getContext('2d');
  const elState = host.querySelector('#brain-state');
  const elReadout = host.querySelector('#brain-readout');
  const elThink = host.querySelector('#brain-think-body');
  const elThinkDot = host.querySelector('#brain-think .bt-dot');
  let scale = 1, offx = 0, offy = 0, running = true;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let activity = 0.25;                    // 0..1 firing intensity (from live state)

  const edgeR = (a) => 1 + 0.045 * Math.sin(6 * a + 0.5) + 0.03 * Math.sin(11 * a);
  function inside(x, y) {
    if (Math.abs(x - CX) < 7) return false;               // longitudinal fissure
    const dx = x - CX, dy = y - CY;
    const front = dy < 0 ? 1 - 0.10 * (-dy / B) : 1;
    const ang = Math.atan2(dy, dx), r = edgeR(ang);
    return (dx / (A * front * r)) ** 2 + (dy / (B * r)) ** 2 <= 1;
  }

  // ---- neurons (calmer density) ----
  const N = 128, neurons = [];
  let guard = 0;
  while (neurons.length < N && guard++ < 20000) {
    const x = 40 + Math.random() * (DW - 80), y = 20 + Math.random() * (DH - 40);
    if (!inside(x, y)) continue;
    let ok = true;
    for (const n of neurons) { if ((n.x - x) ** 2 + (n.y - y) ** 2 < 42 * 42) { ok = false; break; } }
    if (!ok) continue;
    neurons.push({ x, y, phase: Math.random() * 6.28, flash: 0, hemi: x < CX ? 0 : 1 });
  }
  const syn = [], adj = neurons.map(() => []);
  for (let i = 0; i < neurons.length; i++) {
    const a = neurons[i], d = [];
    for (let j = 0; j < neurons.length; j++) {
      if (i === j) continue;
      const b = neurons[j], dist = Math.hypot(a.x - b.x, a.y - b.y), cross = a.hemi !== b.hemi;
      if (dist < 150 && (!cross || Math.random() < 0.10)) d.push([dist, j]);
    }
    d.sort((p, q) => p[0] - q[0]);
    for (const [, j] of d.slice(0, 3)) { if (!adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); syn.push([i, j]); } }
  }
  const folds = [];
  for (let h = 0; h < 2; h++) {
    const sgn = h ? 1 : -1;
    for (let k = 1; k <= 6; k++) {
      const rr = k / 7, pts = [];
      for (let t = -1.15; t <= 1.15; t += 0.12) {
        const px = CX + sgn * (30 + rr * (A - 40)) * Math.abs(Math.cos(t * 0.9));
        const py = CY + t * (B - 22) * rr + 9 * Math.sin(t * 3 + k);
        if (inside(px, py)) pts.push([px, py]);
      }
      if (pts.length > 2) folds.push(pts);
    }
  }

  // ---- impulses ----
  const impulses = [];
  const WEIGHTS = [['read', 0.55], ['entry', 0.18], ['bank', 0.18], ['cut', 0.09]];
  function weightedType() { const r = Math.random(); let a = 0; for (const [k, w] of WEIGHTS) { a += w; if (r <= a) return k; } return 'read'; }
  function spawn(type) {
    if (impulses.length > 12) return;
    const i = (Math.random() * neurons.length) | 0;
    if (!adj[i].length) return;
    impulses.push({ a: i, b: adj[i][(Math.random() * adj[i].length) | 0], t: 0, sp: 0.011 + Math.random() * 0.018, col: COLORS[type] || COLORS.read, life: 4 + ((Math.random() * 5) | 0), trail: [] });
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    scale = Math.min(cv.width / DW, cv.height / DH);
    offx = (cv.width - DW * scale) / 2; offy = (cv.height - DH * scale) / 2;
  }
  const SX = (x) => offx + x * scale, SY = (y) => offy + y * scale;

  let lastSpawn = 0;
  function draw(ts) {
    if (!running) return;
    const t = ts / 1000, breath = 1 + 0.006 * Math.sin(t * 1.05);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate(cv.width / 2, cv.height / 2); ctx.scale(breath, breath); ctx.translate(-cv.width / 2, -cv.height / 2);

    // outline
    ctx.lineWidth = 1.4 * scale; ctx.strokeStyle = 'rgba(34,211,238,.28)';
    ctx.shadowColor = 'rgba(34,211,238,.5)'; ctx.shadowBlur = 13 * scale;
    ctx.beginPath();
    for (let a = 0; a <= 6.2832; a += 0.03) {
      const r = edgeR(a), front = Math.sin(a) < 0 ? 1 - 0.10 * (-Math.sin(a)) : 1;
      const x = CX + Math.cos(a) * A * front * r, y = CY + Math.sin(a) * B * r;
      a === 0 ? ctx.moveTo(SX(x), SY(y)) : ctx.lineTo(SX(x), SY(y));
    }
    ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0;
    // fissure
    ctx.strokeStyle = 'rgba(34,211,238,.15)'; ctx.lineWidth = scale;
    ctx.beginPath(); ctx.moveTo(SX(CX), SY(CY - B * 0.86)); ctx.lineTo(SX(CX), SY(CY + B * 0.86)); ctx.stroke();
    // folds
    ctx.strokeStyle = 'rgba(34,211,238,.06)'; ctx.lineWidth = scale;
    for (const f of folds) { ctx.beginPath(); f.forEach((p, i) => i ? ctx.lineTo(SX(p[0]), SY(p[1])) : ctx.moveTo(SX(p[0]), SY(p[1]))); ctx.stroke(); }
    // synapses
    ctx.strokeStyle = 'rgba(80,140,175,.12)'; ctx.lineWidth = scale; ctx.beginPath();
    for (const [i, j] of syn) { ctx.moveTo(SX(neurons[i].x), SY(neurons[i].y)); ctx.lineTo(SX(neurons[j].x), SY(neurons[j].y)); }
    ctx.stroke();
    // neurons
    for (const n of neurons) {
      const base = 0.32 + 0.28 * Math.sin(t * 1.5 + n.phase), b = Math.min(1, base + n.flash);
      ctx.beginPath(); ctx.fillStyle = `rgba(150,220,245,${0.45 + 0.5 * b})`;
      ctx.shadowColor = 'rgba(34,211,238,.9)'; ctx.shadowBlur = (5 + 9 * b) * scale;
      ctx.arc(SX(n.x), SY(n.y), (1.5 + 1.6 * b) * scale, 0, 6.2832); ctx.fill();
      n.flash *= 0.90;
    }
    ctx.shadowBlur = 0;
    // impulses
    for (let k = impulses.length - 1; k >= 0; k--) {
      const im = impulses[k], a = neurons[im.a], b = neurons[im.b];
      im.t += im.sp;
      const x = a.x + (b.x - a.x) * im.t, y = a.y + (b.y - a.y) * im.t;
      im.trail.push([x, y]); if (im.trail.length > 9) im.trail.shift();
      for (let q = 0; q < im.trail.length; q++) {
        ctx.globalAlpha = (q / im.trail.length) * 0.45; ctx.fillStyle = im.col;
        ctx.beginPath(); ctx.arc(SX(im.trail[q][0]), SY(im.trail[q][1]), 1.4 * scale, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.fillStyle = im.col; ctx.shadowColor = im.col; ctx.shadowBlur = 11 * scale;
      ctx.arc(SX(x), SY(y), 2.5 * scale, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
      if (im.t >= 1) {
        b.flash = 1; im.life--;
        const nb = adj[im.b].filter((z) => z !== im.a);
        if (im.life <= 0 || !nb.length) impulses.splice(k, 1);
        else { im.a = im.b; im.b = nb[(Math.random() * nb.length) | 0]; im.t = 0; im.trail = []; }
      }
    }
    ctx.restore();

    // ambient firing — cadence scales with live activity (calm when idle)
    const interval = 520 - activity * 380;   // ~520ms idle → ~140ms very active
    if (ts - lastSpawn > interval) { lastSpawn = ts; if (Math.random() < 0.85) spawn(weightedType()); }
    raf = requestAnimationFrame(draw);
  }
  let raf = requestAnimationFrame(draw);

  const ro = new ResizeObserver(resize); ro.observe(cv);
  resize();

  return {
    // Fire a colored pulse for a real engine event.
    pulse(type) { spawn(type || 'read'); },
    // Push live state → readout + activity + "what she's thinking".
    update(d) {
      if (!d) return;
      const running = (d.engineState || '').startsWith('RUN');
      elState.innerHTML = `<span class="bh-pulse" style="background:${running ? '#22c55e' : '#64748b'};box-shadow:0 0 8px ${running ? '#22c55e' : 'transparent'}"></span>${running ? 'RUNNING · ' + (d.live ? 'LIVE' : 'SHADOW') : (d.engineState || 'OFFLINE')}`;
      const chg = d.dayChangeUsd;
      elReadout.innerHTML = [
        ['WATCHING', `${d.watching || 0} symbols`],
        ['EVALUATING', `${d.evaluating || 0}/min`],
        ['MANAGING', `${d.managing || 0} position${d.managing === 1 ? '' : 's'}`],
        ['TODAY', `<b class="${chg > 0 ? 'gain' : chg < 0 ? 'loss' : ''}">${chg != null ? money(chg, { sign: true, dp: 0 }) : '—'}</b>`],
      ].map(([k, v]) => `<div class="bro"><span class="brk">${k}</span><span class="brv">${v}</span></div>`).join('');
      // activity: open positions + recent event burst
      activity = Math.max(0, Math.min(1, 0.15 + (d.managing || 0) * 0.18 + (d.recentEvents || 0) * 0.05 + (running ? 0.1 : 0)));
      if (d.think) { elThink.innerHTML = d.think; elThinkDot.style.background = d.thinkColor || '#22d3ee'; elThinkDot.style.boxShadow = `0 0 9px ${d.thinkColor || '#22d3ee'}`; }
    },
    destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

// Build the "current trade — what she's thinking" line from a position's health.
// Returns { html, color } or null when flat.
export function thinkingFor(positions) {
  const opts = (positions || []).filter((p) => (p.instrument_type === 'option' || p.instrument_type == null));
  const open = (positions || []).filter((p) => p.status !== 'closed');
  if (!open.length) return null;
  // most-actionable first: worst health band, else biggest move
  const band = (p) => ({ CRITICAL: 0, WATCH: 1, HEALTHY: 2 }[p.health?.band] ?? 3);
  open.sort((a, b) => band(a) - band(b) || Math.abs(b.pnl_pct || b.health?.pnlPct || 0) - Math.abs(a.pnl_pct || a.health?.pnlPct || 0));
  const p = open[0];
  const h = p.health || {};
  const pnl = h.pnlPct != null ? h.pnlPct : (p.pnl_pct != null ? p.pnl_pct : null);
  const bits = [];
  const sym = `<b>${esc(p.symbol || p.strategy_key || 'position')}</b>`;
  const pnlS = pnl != null ? `<span class="${pnl >= 0 ? 'gain' : 'loss'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%</span>` : '';
  const bandS = h.band ? `<span class="bt-band bt-${(h.band || '').toLowerCase()}">${h.band}</span>` : '';
  // the "read" — prefer the richest live sensory line
  let read = '';
  let color = '#22d3ee';
  if (h.volume?.read) read = h.volume.read;
  else if (h.tape?.pressure) {
    const up = Math.round((h.tape.pressure.upShare || 0.5) * 100);
    read = `order flow ${up >= 55 ? 'buyers in control' : up <= 45 ? 'sellers pressing' : 'balanced'} (${up}% up), forming bar ${h.tape.formingBar?.posInRange >= 0.6 ? 'holding highs' : h.tape.formingBar?.posInRange <= 0.4 ? 'fading' : 'mid-range'}`;
  } else if (h.patterns?.length) read = h.patterns[0].note || h.patterns[0].name;
  else if (h.theta?.mtcNow != null) read = `${h.theta.mtcNow}m to the close, ${pnl >= 0 ? 'in profit — letting it work' : 'watching decay'}`;
  else read = 'reading the tape tick by tick';
  if (h.band === 'CRITICAL') color = '#ef4444';
  else if (pnl != null && pnl >= 10) color = '#eab308';
  else if (pnl != null && pnl < 0) color = '#f59e0b';
  bits.push(`${sym} ${pnlS} ${bandS}`.trim());
  bits.push(`<span class="bt-read">${esc(read)}</span>`);
  return { html: bits.join(' &nbsp;·&nbsp; '), color };
}
