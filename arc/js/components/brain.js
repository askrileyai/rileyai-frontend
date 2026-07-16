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
const CX = 500, CY = 285, A = 348, B = 214; // top-down brain ellipse
const COLORS = { read: '#22d3ee', entry: '#22c55e', bank: '#eab308', cut: '#ef4444' };

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

// Deterministic point INSIDE the ellipse for a symbol (stable placement).
function placeHotspot(sym, i) {
  const s = String(sym || '') + ':' + i;
  let hsh = 0; for (let k = 0; k < s.length; k++) hsh = (hsh * 31 + s.charCodeAt(k)) & 0xffff;
  const ang = (hsh % 360) * Math.PI / 180;
  const rad = 0.42 + ((hsh >> 4) % 100) / 100 * 0.32;      // 0.42..0.74 of the extent
  return { x: CX + Math.cos(ang) * A * rad * 0.82, y: CY + Math.sin(ang) * B * rad * 0.82 };
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

  const edgeR = (a) => 1 + 0.045 * Math.sin(6 * a + 0.5) + 0.03 * Math.sin(11 * a);
  function inside(x, y) {
    if (Math.abs(x - CX) < 7) return false;
    const dx = x - CX, dy = y - CY, front = dy < 0 ? 1 - 0.10 * (-dy / B) : 1, ang = Math.atan2(dy, dx), r = edgeR(ang);
    return (dx / (A * front * r)) ** 2 + (dy / (B * r)) ** 2 <= 1;
  }
  // neurons + synapses
  const N = 116, neurons = [];
  let guard = 0;
  while (neurons.length < N && guard++ < 20000) {
    const x = 40 + Math.random() * (DW - 80), y = 20 + Math.random() * (DH - 40);
    if (!inside(x, y)) continue;
    let ok = true; for (const n of neurons) { if ((n.x - x) ** 2 + (n.y - y) ** 2 < 42 * 42) { ok = false; break; } }
    if (ok) neurons.push({ x, y, phase: Math.random() * 6.28, flash: 0, hemi: x < CX ? 0 : 1 });
  }
  const syn = [], adj = neurons.map(() => []);
  for (let i = 0; i < neurons.length; i++) {
    const a = neurons[i], d = [];
    for (let j = 0; j < neurons.length; j++) { if (i === j) continue; const b = neurons[j], dist = Math.hypot(a.x - b.x, a.y - b.y), cross = a.hemi !== b.hemi; if (dist < 150 && (!cross || Math.random() < 0.1)) d.push([dist, j]); }
    d.sort((p, q) => p[0] - q[0]);
    for (const [, j] of d.slice(0, 3)) { if (!adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); syn.push([i, j]); } }
  }
  const imp = [], ripples = [];
  const WT = [['read', 0.55], ['entry', 0.18], ['bank', 0.18], ['cut', 0.09]];
  const wpick = () => { const r = Math.random(); let a = 0; for (const [k, w] of WT) { a += w; if (r <= a) return k; } return 'read'; };
  function spawn(type) { if (imp.length > 11) return; const i = (Math.random() * neurons.length) | 0; if (!adj[i].length) return; imp.push({ a: i, b: adj[i][(Math.random() * adj[i].length) | 0], t: 0, sp: 0.011 + Math.random() * 0.018, col: COLORS[type] || COLORS.read, life: 4 + ((Math.random() * 5) | 0), tr: [] }); }

  function resize() { const r = cv.getBoundingClientRect(); if (!r.width) return; cv.width = r.width * dpr; cv.height = r.height * dpr; scale = Math.min(cv.width / DW, cv.height / DH); offx = (cv.width - DW * scale) / 2; offy = (cv.height - DH * scale) / 2; }
  const SX = (x) => offx + x * scale, SY = (y) => offy + y * scale;

  let lastSpawn = 0;
  function draw(ts) {
    if (!running) return;
    const t = ts / 1000, breath = 1 + 0.006 * Math.sin(t * 1.05);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let k = 0; k < 3; k++) { const pr = ((t * 36 + k * 90) % 250); ctx.beginPath(); ctx.strokeStyle = `rgba(34,211,238,${0.08 * (1 - pr / 250)})`; ctx.lineWidth = 1.2; ctx.arc(SX(CX), SY(CY), pr * scale, 0, 6.2832); ctx.stroke(); }
    ctx.save(); ctx.translate(cv.width / 2, cv.height / 2); ctx.scale(breath, breath); ctx.translate(-cv.width / 2, -cv.height / 2);
    // outline
    ctx.lineWidth = 1.4 * scale; ctx.globalAlpha = 0.3; ctx.strokeStyle = '#22d3ee'; ctx.shadowColor = 'rgba(34,211,238,.5)'; ctx.shadowBlur = 13 * scale; ctx.beginPath();
    for (let a = 0; a <= 6.2832; a += 0.03) { const r = edgeR(a), f = Math.sin(a) < 0 ? 1 - 0.10 * (-Math.sin(a)) : 1, x = CX + Math.cos(a) * A * f * r, y = CY + Math.sin(a) * B * r; a === 0 ? ctx.moveTo(SX(x), SY(y)) : ctx.lineTo(SX(x), SY(y)); }
    ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(34,211,238,.14)'; ctx.lineWidth = scale; ctx.beginPath(); ctx.moveTo(SX(CX), SY(CY - B * 0.86)); ctx.lineTo(SX(CX), SY(CY + B * 0.86)); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,150,175,.12)'; ctx.lineWidth = scale; ctx.beginPath(); for (const [i, j] of syn) { ctx.moveTo(SX(neurons[i].x), SY(neurons[i].y)); ctx.lineTo(SX(neurons[j].x), SY(neurons[j].y)); } ctx.stroke();
    for (const n of neurons) { const base = 0.3 + 0.26 * Math.sin(t * 1.5 + n.phase), b = Math.min(1, base + n.flash); ctx.beginPath(); ctx.fillStyle = `rgba(160,225,245,${0.42 + 0.5 * b})`; ctx.shadowColor = 'rgba(34,211,238,.9)'; ctx.shadowBlur = (5 + 9 * b) * scale; ctx.arc(SX(n.x), SY(n.y), (1.4 + 1.6 * b) * scale, 0, 6.2832); ctx.fill(); n.flash *= 0.9; }
    ctx.shadowBlur = 0;
    for (let k = imp.length - 1; k >= 0; k--) {
      const m = imp[k], a = neurons[m.a], b = neurons[m.b]; m.t += m.sp; const x = a.x + (b.x - a.x) * m.t, y = a.y + (b.y - a.y) * m.t; m.tr.push([x, y]); if (m.tr.length > 10) m.tr.shift();
      for (let q = 0; q < m.tr.length; q++) { ctx.globalAlpha = (q / m.tr.length) * 0.45; ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(SX(m.tr[q][0]), SY(m.tr[q][1]), 1.4 * scale, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.fillStyle = m.col; ctx.shadowColor = m.col; ctx.shadowBlur = 11 * scale; ctx.arc(SX(x), SY(y), 2.5 * scale, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
      if (m.t >= 1) { b.flash = 1; m.life--; const nb = adj[m.b].filter((z) => z !== m.a); if (m.life <= 0 || !nb.length) imp.splice(k, 1); else { m.a = m.b; m.b = nb[(Math.random() * nb.length) | 0]; m.t = 0; m.tr = []; } }
    }
    // POSITION HOTSPOTS
    ctx.textAlign = 'center'; ctx.font = `700 ${12 * scale}px 'IBM Plex Mono',monospace`;
    for (const p of hotspots) { const pu = 0.5 + 0.5 * Math.sin(t * 2.2), R = (14 + 4 * pu) * scale;
      ctx.beginPath(); ctx.strokeStyle = p.color; ctx.globalAlpha = 0.5 + 0.4 * pu; ctx.lineWidth = 2 * scale; ctx.shadowColor = p.color; ctx.shadowBlur = 15 * scale; ctx.arc(SX(p.x), SY(p.y), R, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.globalAlpha = 1; ctx.fillStyle = p.color; ctx.arc(SX(p.x), SY(p.y), 4 * scale, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = p.color; ctx.fillText(`${p.sym}${p.pnl != null ? ' ' + (p.pnl >= 0 ? '+' : '') + p.pnl.toFixed(0) + '%' : ''}`, SX(p.x), SY(p.y) - R - 6 * scale); }
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
    let hit = null; for (const p of hotspots) { const dx = mx - SX(p.x) / dpr, dy = my - SY(p.y) / dpr; if (dx * dx + dy * dy < 28 * 28) { hit = p; break; } }
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
      hotspots = open.slice(0, 6).map((p, i) => { const pt = placeHotspot(p.symbol || p.strategy_key, i), r = readOne(p); return { x: pt.x, y: pt.y, sym: p.symbol || p.strategy_key || '?', pnl: r.pnl, color: hotspotColor(r.pnl), band: r.band, read: r.read }; });
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
