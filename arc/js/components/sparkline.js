// @ts-check
// Canvas sparkline — amber line, soft glow, area fade. ~60 lines, no deps.

export function drawSparkline(canvas, points, { stroke, glow } = {}) {
  if (!canvas || !points || points.length < 2) return;
  const css = getComputedStyle(document.documentElement);
  const lineColor = stroke || css.getPropertyValue('--accent-hi').trim() || '#22d3ee';
  const glowColor = glow || 'rgba(34,211,238,.28)';

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 64;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const px = (i) => (i / (points.length - 1)) * (w - 4) + 2;
  const py = (v) => h - 6 - ((v - min) / span) * (h - 12);

  // area fade
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, glowColor.replace(/[\d.]+\)$/, '0.18)'));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(px(0), py(points[0]));
  points.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(points.length - 1), h);
  ctx.lineTo(px(0), h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // glow pass + crisp pass
  ctx.lineJoin = 'round';
  for (const [width, blur] of [[3, 8], [1.4, 0]]) {
    ctx.beginPath();
    ctx.moveTo(px(0), py(points[0]));
    points.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineWidth = width;
    ctx.strokeStyle = lineColor;
    ctx.shadowColor = blur ? glowColor : 'transparent';
    ctx.shadowBlur = blur;
    ctx.globalAlpha = blur ? 0.55 : 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}
