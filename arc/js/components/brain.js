// @ts-check
// THE ARC — RILEY'S MIND (v4). A live neural-brain dashboard that replaces the
// equity chart. Open positions show as glowing labeled clusters ON the cortex;
// tap a position for its live read, tap anywhere for Riley's overall "now" read
// (with a ripple). The live feed sits beside the brain, and a "Today's Rhythm"
// timeline underneath plots the day's decisions (entry/bank/cut) on a 9:30→4:00
// axis. Everything is account-aware — bridge passes the SELECTED account's
// positions + events. mountBrain(host) sets up the canvas + animation ONCE and
// returns { update(d), pulse(type), destroy() }.

import { money, esc } from './fmt.js';

const DW = 1000, DH = 560;                  // design space (brain region)
const CX = 500, CY = 285;                   // projection centre
// v5 — TRUE 3D. The cortex is an ELLIPSOID VOLUME turning on its vertical axis,
// not a flat silhouette: neurons carry x/y/z, every point is rotated then
// perspective-projected, and everything is depth-sorted so the far hemisphere
// draws behind the near one. A/B/C are the semi-axes (x wide, y tall, z deep).
const A = 300, B = 196, C = 250;
const PD = 980;                             // perspective distance (smaller = more dramatic)
const ROT = 0.20;                           // radians/sec ≈ one turn per 31s
const MIDLINE = 16;                         // hemispheric fissure half-width in x
// Gentle cortical lumpiness so the volume reads as a brain, not a billiard ball.
const surf = (phi, lam) => 1 + 0.065 * Math.sin(3 * lam) * Math.sin(2 * phi) + 0.04 * Math.sin(5 * phi);
const COLORS = { read: '#22d3ee', entry: '#22c55e', bank: '#eab308', cut: '#ef4444' };

// Rotate a 3D point about the Y axis by theta, then project to design space.
// Returns screen-space x/y, the depth scale k (1 = at centre) and the rotated z
// (negative = nearer the viewer) for sorting and fog.
function project(p, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const x = p.x * c + p.z * s;
  const z = -p.x * s + p.z * c;
  const k = PD / (PD + z);
  return { x: CX + x * k, y: CY + p.y * k, k, z };
}

// Map a live engine event type → a pulse/decision color bucket.
export function pulseTypeFor(t) {
  t = String(t || '');
  if (/^position\.(opened|entry)|^order\.(filled|submitted)|^signal\.accepted/.test(t)) return 'entry';
  if (/scale_out|riley_bank|peak_bank|profit_protect/.test(t)) return 'bank';
  if (/stop|loss_floor|theta|risk\.halt|scratch|\bcut\b/.test(t)) return 'cut';
  if (/^position\.closed/.test(t)) return 'bank';           // refined by P&L sign in the rhythm
  return 'read';
}

// The live "read" for a single position, from its health payload.
function readOne(p) {
  const h = p.health || {};
  const pnl = h.pnlPct != null ? h.pnlPct : (p.pnl_pct != null ? p.pnl_pct : null);
  let read = '';
  if (h.volume && h.volume.read) read = h.volume.read;
  else if (h.tape && h.tape.pressure) {
    const up = Math.round((h.tape.pressure.upShare || 0.5) * 100);
    read = `order flow ${up >= 55 ? 'buyers in control' : up <= 45 ? 'sellers pressing' : 'balanced'} (${up}% up)${h.tape.formingBar && h.tape.formingBar.posInRange != null ? `, bar ${h.tape.formingBar.posInRange >= 0.6 ? 'holding highs' : h.tape.formingBar.posInRange <= 0.4 ? 'fading' : 'mid-range'}` : ''}`;
  } else if (h.patterns && h.patterns.length) read = h.patterns[0].note || h.patterns[0].name;
  else if (h.theta && h.theta.mtcNow != null) read = `${h.theta.mtcNow}m to the close — ${pnl >= 0 ? 'in profit, letting it work' : 'watching decay'}`;
  else read = 'reading the tape tick by tick';
  const band = h.band || null;
  let color = '#22c55e';
  if (band === 'CRITICAL') color = '#ef4444';
  else if (pnl != null && pnl >= 12) color = '#eab308';
  else if (pnl != null && pnl < 0) color = '#f59e0b';
  return { pnl, band, read, color };
}

// Kept for compatibility — the single most-actionable read across positions.
export function thinkingFor(positions) {
  const open = (positions || []).filter((p) => p.status !== 'closed');
  if (!open.length) return null;
  const bandRank = (p) => ({ CRITICAL: 0, WATCH: 1, HEALTHY: 2 }[(p.health || {}).band] ?? 3);
  open.sort((a, b) => bandRank(a) - bandRank(b));
  const p = open[0], r = readOne(p);
  return { html: `<b>${esc(p.symbol || p.strategy_key)}</b> ${r.read}`, color: r.color };
}

// Deterministic point ON THE CORTEX (3D) for a symbol — stable across repaints,
// and now anchored in the volume so it turns with the brain and passes behind it.
function placeHotspot(sym, i) {
  const s = String(sym || '') + ':' + i;
  let hsh = 0; for (let k = 0; k < s.length; k++) hsh = (hsh * 31 + s.charCodeAt(k)) & 0xffff;
  const lam = (hsh % 360) * Math.PI / 180;                  // longitude
  const phi = 0.60 + ((hsh >> 4) % 100) / 100 * 1.94;       // polar, biased off the poles
  const r = 0.90 * surf(phi, lam);                          // just under the surface
  return {
    x: A * r * Math.sin(phi) * Math.cos(lam),
    y: B * r * Math.cos(phi),
    z: C * r * Math.sin(phi) * Math.sin(lam),
  };
}
function hotspotColor(pnl) { return pnl == null ? '#22d3ee' : pnl >= 15 ? '#eab308' : pnl >= 0 ? '#22c55e' : '#ef4444'; }

// ET minutes-of-day for a timestamp (for the rhythm axis).
function etMin(ts) {
  try { const d = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'America/New_York' })); return d.getHours() * 60 + d.getMinutes(); }
  catch (_) { return null; }
}
const OPEN_MIN = 570, CLOSE_MIN = 960;                      // 9:30 → 16:00 ET
const rhythmPct = (m) => Math.max(0, Math.min(100, ((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * 100));

export function mountBrain(host) {
  host.innerHTML = `
    <div class="brain-panel">
      <div class="brain-head">
        <div class="bh-l"><span class="bh-dot"></span>THE&nbsp;ARC <span class="bh-sub">— RILEY'S MIND</span><span class="bh-acct" id="brain-acct"></span></div>
        <div class="bh-r" id="brain-state"><span class="bh-pulse"></span>—</div>
      </div>
      <div class="brain-readout" id="brain-readout"></div>
      <div class="brain-main">
        <div class="brain-stage" id="brain-stage">
          <span class="cb tl"></span><span class="cb tr"></span><span class="cb bl"></span><span class="cb br"></span>
          <canvas id="brain-cv"></canvas>
          <div class="brain-hint" id="brain-hint">tap a position, or anywhere on the cortex</div>
        </div>
        <div class="brain-feed">
          <div class="bf-h"><span class="bf-live"></span>LIVE FEED</div>
          <div class="bf-body" id="brain-feed"></div>
        </div>
      </div>
      <div class="brain-rhythm">
        <div class="br-h">TODAY'S RHYTHM <span class="br-count" id="brain-rcount"></span></div>
        <div class="br-line" id="brain-rline"><div class="br-track"></div></div>
        <div class="br-ax"><span>9:30</span><span>11:00</span><span>12:30</span><span>2:00</span><span>4:00</span></div>
      </div>
      <div class="brain-callout" id="brain-callout" hidden></div>
    </div>`;

  const panel = host.querySelector('.brain-panel');
  const cv = host.querySelector('#brain-cv');
  const ctx = cv.getContext('2d');
  const elAcct = host.querySelector('#brain-acct');
  const elState = host.querySelector('#brain-state');
  const elReadout = host.querySelector('#brain-readout');
  const elFeed = host.querySelector('#brain-feed');
  const elHint = host.querySelector('#brain-hint');
  const elRline = host.querySelector('#brain-rline');
  const elRcount = host.querySelector('#brain-rcount');
  const callout = host.querySelector('#brain-callout');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let scale = 1, offx = 0, offy = 0, running = true, activity = 0.2;
  let hotspots = [];                     // {x,y,sym,pnl,color,band,read}
  let overall = 'Scanning the tape for the next setup.';

  // NEURONS IN 3D — rejection-sampled inside the ellipsoid, with a hemispheric
  // fissure down the middle and a minimum 3D separation so they never clump.
  const N = 132, neurons = [];
  let guard = 0;
  while (neurons.length < N && guard++ < 60000) {
    const x = (Math.random() * 2 - 1) * A, y = (Math.random() * 2 - 1) * B, z = (Math.random() * 2 - 1) * C;
    const rr = (x / A) ** 2 + (y / B) ** 2 + (z / C) ** 2;
    if (rr > 0.92) continue;                                   // inside, just under the surface
    if (Math.abs(x) < MIDLINE) continue;                       // the fissure
    let ok = true;
    for (const n of neurons) { if ((n.x - x) ** 2 + (n.y - y) ** 2 + (n.z - z) ** 2 < 52 * 52) { ok = false; break; } }
    if (ok) neurons.push({ x, y, z, phase: Math.random() * 6.28, flash: 0, hemi: x < 0 ? 0 : 1 });
  }
  const syn = [], adj = neurons.map(() => []);
  for (let i = 0; i < neurons.length; i++) {
    const a = neurons[i], d = [];
    for (let j = 0; j < neurons.length; j++) {
      if (i === j) continue;
      const b = neurons[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), cross = a.hemi !== b.hemi;
      if (dist < 165 && (!cross || Math.random() < 0.08)) d.push([dist, j]);
    }
    d.sort((p, q) => p[0] - q[0]);
    for (const [, j] of d.slice(0, 3)) { if (!adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); syn.push([i, j]); } }
  }
  // Wireframe shell: meridians + latitude rings, precomputed in 3D once.
  const shell = [];
  for (let m = 0; m < 8; m++) {
    const lam = (m / 8) * Math.PI * 2, pts = [];
    for (let phi = 0.06; phi <= Math.PI - 0.06; phi += 0.10) {
      const r = surf(phi, lam);
      pts.push({ x: A * r * Math.sin(phi) * Math.cos(lam), y: B * r * Math.cos(phi), z: C * r * Math.sin(phi) * Math.sin(lam) });
    }
    shell.push(pts);
  }
  for (const fy of [-0.55, 0, 0.55]) {
    const pts = [], ry = Math.sqrt(Math.max(0, 1 - fy * fy));
    for (let u = 0; u <= 6.2832 + 0.1; u += 0.10) {
      const phi = Math.acos(fy), r = surf(phi, u);
      pts.push({ x: A * r * ry * Math.cos(u), y: B * fy * r, z: C * r * ry * Math.sin(u) });
    }
    shell.push(pts);
  }
  const imp = [], ripples = [];
  const WT = [['read', 0.55], ['entry', 0.18], ['bank', 0.18], ['cut', 0.09]];
  const wpick = () => { const r = Math.random(); let a = 0; for (const [k, w] of WT) { a += w; if (r <= a) return k; } return 'read'; };
  function spawn(type) { if (imp.length > 11) return; const i = (Math.random() * neurons.length) | 0; if (!adj[i].length) return; imp.push({ a: i, b: adj[i][(Math.random() * adj[i].length) | 0], t: 0, sp: 0.011 + Math.random() * 0.018, col: COLORS[type] || COLORS.read, life: 4 + ((Math.random() * 5) | 0), tr: [] }); }

  function resize() { const r = cv.getBoundingClientRect(); if (!r.width) return; cv.width = r.width * dpr; cv.height = r.height * dpr; scale = Math.min(cv.width / DW, cv.height / DH); offx = (cv.width - DW * scale) / 2; offy = (cv.height - DH * scale) / 2; }
  const SX = (x) => offx + x * scale, SY = (y) => offy + y * scale;

  let lastSpawn = 0;
  // Depth → fog. z runs −C (nearest) .. +C (furthest); 0 = the equator.
  const fog = (z) => Math.max(0.10, Math.min(1, 0.62 - z / (C * 2.35)));
  function draw(ts) {
    if (!running) return;
    const t = ts / 1000, breath = 1 + 0.006 * Math.sin(t * 1.05);
    const th = t * ROT;                                  // ← the turn
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let k = 0; k < 3; k++) { const pr = ((t * 36 + k * 90) % 250); ctx.beginPath(); ctx.strokeStyle = `rgba(34,211,238,${0.08 * (1 - pr / 250)})`; ctx.lineWidth = 1.2; ctx.arc(SX(CX), SY(CY), pr * scale, 0, 6.2832); ctx.stroke(); }
    ctx.save(); ctx.translate(cv.width / 2, cv.height / 2); ctx.scale(breath, breath); ctx.translate(-cv.width / 2, -cv.height / 2);

    // Project everything ONCE per frame, then paint strictly back-to-front so
    // the far hemisphere sits behind the near one — that is what sells the 3D.
    const P = neurons.map((n) => project(n, th));
    const hp = hotspots.map((p) => project(p, th));
    hotspots.forEach((p, i) => { p._sx = SX(hp[i].x); p._sy = SY(hp[i].y); p._k = hp[i].k; p._front = hp[i].z < 40; });

    // wireframe shell (subtle, depth-faded)
    ctx.lineWidth = 1.05 * scale;
    for (const ring of shell) {
      let prev = null;
      for (const pt of ring) {
        const q = project(pt, th);
        if (prev) {
          ctx.beginPath();
          ctx.globalAlpha = 0.20 * fog(q.z);
          ctx.strokeStyle = '#22d3ee';
          ctx.moveTo(SX(prev.x), SY(prev.y)); ctx.lineTo(SX(q.x), SY(q.y)); ctx.stroke();
        }
        prev = q;
      }
    }
    ctx.globalAlpha = 1;

    // synapses — sorted far→near, faded by depth
    const sl = syn.map(([i, j]) => ({ i, j, z: (P[i].z + P[j].z) / 2 })).sort((a, b) => b.z - a.z);
    for (const s of sl) {
      ctx.beginPath();
      ctx.globalAlpha = 0.34 * fog(s.z);
      ctx.strokeStyle = 'rgba(120,190,215,1)';
      ctx.lineWidth = scale * (0.6 + 0.5 * fog(s.z));
      ctx.moveTo(SX(P[s.i].x), SY(P[s.i].y)); ctx.lineTo(SX(P[s.j].x), SY(P[s.j].y)); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // neurons — far→near, size and glow scale with depth
    const order = neurons.map((_, i) => i).sort((a, b) => P[b].z - P[a].z);
    for (const i of order) {
      const n = neurons[i], q = P[i], f = fog(q.z);
      const base = 0.3 + 0.26 * Math.sin(t * 1.5 + n.phase), b = Math.min(1, base + n.flash);
      ctx.beginPath();
      ctx.fillStyle = `rgba(160,225,245,${(0.30 + 0.55 * b) * f})`;
      ctx.shadowColor = 'rgba(34,211,238,.9)'; ctx.shadowBlur = (4 + 9 * b) * scale * q.k;
      ctx.arc(SX(q.x), SY(q.y), (1.15 + 1.7 * b) * scale * q.k, 0, 6.2832); ctx.fill();
      n.flash *= 0.9;
    }
    ctx.shadowBlur = 0;

    // impulses — interpolate in 3D, then project
    for (let k = imp.length - 1; k >= 0; k--) {
      const m = imp[k], a = neurons[m.a], b = neurons[m.b];
      m.t += m.sp;
      const q = project({ x: a.x + (b.x - a.x) * m.t, y: a.y + (b.y - a.y) * m.t, z: a.z + (b.z - a.z) * m.t }, th);
      const f = fog(q.z);
      m.tr.push([q.x, q.y, f, q.k]); if (m.tr.length > 10) m.tr.shift();
      for (let w = 0; w < m.tr.length; w++) { ctx.globalAlpha = (w / m.tr.length) * 0.45 * m.tr[w][2]; ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(SX(m.tr[w][0]), SY(m.tr[w][1]), 1.4 * scale * m.tr[w][3], 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = f; ctx.beginPath(); ctx.fillStyle = m.col; ctx.shadowColor = m.col; ctx.shadowBlur = 11 * scale; ctx.arc(SX(q.x), SY(q.y), 2.5 * scale * q.k, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      if (m.t >= 1) { b.flash = 1; m.life--; const nb = adj[m.b].filter((z) => z !== m.a); if (m.life <= 0 || !nb.length) imp.splice(k, 1); else { m.a = m.b; m.b = nb[(Math.random() * nb.length) | 0]; m.t = 0; m.tr = []; } }
    }

    // POSITION HOTSPOTS — ride the cortex, dim as they swing behind it
    ctx.textAlign = 'center';
    const hOrder = hotspots.map((_, i) => i).sort((a, b) => hp[b].z - hp[a].z);
    for (const i of hOrder) {
      const p = hotspots[i], q = hp[i], f = fog(q.z), pu = 0.5 + 0.5 * Math.sin(t * 2.2);
      const R = (13 + 4 * pu) * scale * q.k;
      ctx.font = `700 ${12 * scale * q.k}px 'IBM Plex Mono',monospace`;
      ctx.beginPath(); ctx.strokeStyle = p.color; ctx.globalAlpha = (0.5 + 0.4 * pu) * f; ctx.lineWidth = 2 * scale * q.k;
      ctx.shadowColor = p.color; ctx.shadowBlur = 15 * scale * f; ctx.arc(SX(q.x), SY(q.y), R, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.globalAlpha = f; ctx.fillStyle = p.color; ctx.arc(SX(q.x), SY(q.y), 4 * scale * q.k, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
      // Only label the front face — a label on the far side reads as noise.
      if (p._front) { ctx.globalAlpha = Math.min(1, f * 1.25); ctx.fillStyle = p.color; ctx.fillText(`${p.sym}${p.pnl != null ? ' ' + (p.pnl >= 0 ? '+' : '') + p.pnl.toFixed(0) + '%' : ''}`, SX(q.x), SY(q.y) - R - 6 * scale); }
      ctx.globalAlpha = 1;
    }
    for (let k = ripples.length - 1; k >= 0; k--) { const r = ripples[k]; r.t += 0.03; ctx.beginPath(); ctx.strokeStyle = '#22d3ee'; ctx.globalAlpha = (1 - r.t) * 0.6; ctx.lineWidth = 2 * scale; ctx.arc(r.x, r.y, r.t * 120 * scale, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; if (r.t >= 1) ripples.splice(k, 1); }
    ctx.restore();
    const interval = 520 - activity * 380;
    if (ts - lastSpawn > interval) { lastSpawn = ts; if (Math.random() < 0.85) spawn(wpick()); }
    raf = requestAnimationFrame(draw);
  }
  let raf = requestAnimationFrame(draw);
  const ro = new ResizeObserver(resize); ro.observe(cv); resize();

  // ---- callout: anchored to the PANEL, clamped, flips below when near the top ----
  function showCallout(clientX, clientY, html, col) {
    callout.style.setProperty('--cc', col); callout.innerHTML = html; callout.hidden = false;
    const rr = panel.getBoundingClientRect(), cw = callout.offsetWidth, ch = callout.offsetHeight;
    let x = clientX - rr.left, y = clientY - rr.top;
    let left = Math.max(8, Math.min(x - cw / 2, rr.width - cw - 8));
    let top = y - ch - 12; if (top < 6) top = y + 18; top = Math.min(top, rr.height - ch - 8);
    callout.style.left = left + 'px'; callout.style.top = top + 'px';
  }
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    // Hit-test against the LAST PROJECTED position (the brain is turning, so the
    // 3D anchor is not where it appears). Front-facing hotspots win a tie.
    let hit = null, bestZ = Infinity;
    for (const p of hotspots) {
      if (p._sx == null) continue;
      const dx = mx - p._sx / dpr, dy = my - p._sy / dpr;
      const rr = 30 * (p._k || 1);
      if (dx * dx + dy * dy < rr * rr) { const z = p._front ? 0 : 1; if (z < bestZ) { bestZ = z; hit = p; } }
    }
    ripples.push({ x: mx * dpr, y: my * dpr, t: 0 }); for (let i = 0; i < 4; i++) setTimeout(() => spawn(wpick()), i * 60);
    if (hit) showCallout(e.clientX, e.clientY, `<div class="co-h"><span>${esc(hit.sym)}</span>${hit.pnl != null ? `<span style="color:${hit.color};font-weight:700">${hit.pnl >= 0 ? '+' : ''}${hit.pnl.toFixed(1)}%</span>` : ''}${hit.band ? `<span class="co-band bt-${hit.band.toLowerCase()}">${hit.band}</span>` : ''}</div>${esc(hit.read)}`, hit.color);
    else showCallout(e.clientX, e.clientY, `<div class="co-h">RILEY · now</div>${overall}`, '#22d3ee');
    elHint.style.opacity = '0';
  });
  panel.addEventListener('click', (e) => { if (!e.target.closest('#brain-stage') && !callout.hidden) callout.hidden = true; });

  return {
    pulse(type) { spawn(type || 'read'); },
    update(d) {
      if (!d) return;
      const isRun = String(d.engineState || '').startsWith('RUN');
      elAcct.textContent = d.acctLabel ? '· ' + d.acctLabel : '';
      elState.innerHTML = `<span class="bh-pulse" style="background:${isRun ? '#22c55e' : '#64748b'};box-shadow:0 0 8px ${isRun ? '#22c55e' : 'transparent'}"></span>${isRun ? 'RUNNING · ' + (d.live ? 'LIVE' : 'SHADOW') : (d.engineState || 'OFFLINE')}`;
      const chg = d.dayChangeUsd;
      elReadout.innerHTML = [
        ['WATCHING', `${d.watching || 0} symbols`], ['EVALUATING', `${d.evaluating || 0}/min`],
        ['MANAGING', `${d.managing || 0} position${d.managing === 1 ? '' : 's'}`],
        ['TODAY', `<b class="${chg > 0 ? 'gain' : chg < 0 ? 'loss' : ''}">${chg != null ? money(chg, { sign: true, dp: 0 }) : '—'}</b>`],
      ].map(([k, v]) => `<div class="bro"><span class="brk">${k}</span><span class="brv">${v}</span></div>`).join('');

      // hotspots from the account's open positions
      const open = (d.positions || []).filter((p) => p.status !== 'closed');
      hotspots = open.slice(0, 6).map((p, i) => { const pt = placeHotspot(p.symbol || p.strategy_key, i), r = readOne(p); return { x: pt.x, y: pt.y, z: pt.z, sym: p.symbol || p.strategy_key || '?', pnl: r.pnl, color: hotspotColor(r.pnl), band: r.band, read: r.read }; });
      elHint.style.opacity = hotspots.length ? '' : '0.6';
      overall = open.length
        ? `Managing <b>${open.length} position${open.length === 1 ? '' : 's'}</b> — ${open.map((p) => esc(p.symbol || p.strategy_key)).slice(0, 4).join(', ')}. ${d.regime ? esc(d.regime) + ' tape · ' : ''}watching for the next move.`
        : `Flat — scanning ${d.watching || 8} names for the next setup.`;
      activity = Math.max(0, Math.min(1, 0.15 + open.length * 0.18 + (d.recentEvents || 0) * 0.05 + (isRun ? 0.1 : 0)));

      // live feed (folded in)
      const evs = (d.events || []).filter((e) => e.type !== 'position.mark' && e.type !== 'heartbeat').slice(-6).reverse();
      elFeed.innerHTML = evs.length ? evs.map((e) => `<div class="bfl"><i style="color:${COLORS[pulseTypeFor(e.type)]}"></i><span>${esc(e.summary || e.type)}</span></div>`).join('') : `<div class="bfl faint">Quiet — no engine activity yet.</div>`;

      // today's rhythm — decision dots
      const decisions = (d.events || []).filter((e) => /position\.(opened|closed)/.test(e.type || '')).map((e) => {
        const m = etMin(e.ts); if (m == null) return null;
        let type = 'entry';
        if (/closed/.test(e.type)) type = /[-−]\$|loss|\bstop\b|theta|scratch|cut/i.test(e.summary || '') ? 'cut' : 'bank';
        return { pct: rhythmPct(m), type, summary: e.summary || '', clientReady: true };
      }).filter(Boolean);
      const nowM = (() => { const dt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })); return dt.getHours() * 60 + dt.getMinutes(); })();
      elRcount.textContent = decisions.length ? `· ${decisions.length} decision${decisions.length === 1 ? '' : 's'} today` : '· quiet so far';
      elRline.innerHTML = `<div class="br-track"></div>`
        + decisions.map((x) => `<div class="br-dot" style="left:${x.pct}%;background:${COLORS[x.type]};color:${COLORS[x.type]}" title="${esc(x.summary)}"></div>`).join('')
        + (nowM >= OPEN_MIN - 20 && nowM <= CLOSE_MIN + 20 ? `<div class="br-now" style="left:${rhythmPct(nowM)}%"></div>` : '');
    },
    destroy() { running = false; cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
