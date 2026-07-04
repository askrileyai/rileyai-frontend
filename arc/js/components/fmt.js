// @ts-check
// Formatters — money, percent, time. Tabular, terse, HUD-flavored.

export function money(n, { sign = false, dp = 2 } = {}) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const s = sign && v > 0 ? '+' : '';
  return s + v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function pct(n, { sign = true, dp = 1 } = {}) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  return (sign && v > 0 ? '+' : '') + v.toFixed(dp) + '%';
}

export function num(n, dp = 2) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function tTime(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  const p = (x, l = 2) => String(x).padStart(l, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3).slice(0, 3)}`;
}

export function clockET(now = new Date()) {
  return now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' }) + ' ET';
}

export function pnlClass(v) {
  return Number(v) > 0 ? 'gain' : Number(v) < 0 ? 'loss' : 'dim';
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
