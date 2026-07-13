// @ts-check
// API client. Key rides X-Arc-Key; 401/403 clears the key and returns to
// the gate (mirrors the Command Center pattern). localStorage.arc_api_base
// overrides the backend for local/staging work.

import * as bus from './bus.js';

export const API_BASE = (localStorage.getItem('arc_api_base') || 'https://rileyai-backend-production.up.railway.app/api').replace(/\/$/, '');

export function getKey() { return localStorage.getItem('arc_key') || ''; }
export function setKey(k) { localStorage.setItem('arc_key', k); }
export function clearKey() { localStorage.removeItem('arc_key'); }

export function isSim() { return localStorage.getItem('arc_sim') === '1'; }
export function setSim(on) {
  if (on) localStorage.setItem('arc_sim', '1');
  else localStorage.removeItem('arc_sim');
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function req(path, opts = {}) {
  const res = await fetch(`${API_BASE}/arc${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Arc-Key': getKey(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    clearKey();
    bus.emit('auth', { lost: true });
    throw new ApiError('IDENTITY NOT VERIFIED', res.status);
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch (_) {}
    throw new ApiError(msg, res.status);
  }
  return res.json();
}

export const api = {
  status: () => req('/status'),
  config: () => req('/config'),
  saveConfig: (body) => req('/config', { method: 'PUT', body: JSON.stringify(body) }),
  strategies: () => req('/strategies'),
  saveStrategy: (key, body) => req(`/strategies/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(body) }),
  positions: (status = 'open', limit = 50) => req(`/positions?status=${status}&limit=${limit}`),
  orders: (limit = 50) => req(`/orders?limit=${limit}`),
  log: (params = '') => req(`/log${params}`),
  kill: (level, reason) => req('/kill', { method: 'POST', body: JSON.stringify({ level, reason }) }),
  resume: () => req('/resume', { method: 'POST', body: JSON.stringify({ confirm: 'RESUME' }) }),
  flattenReal: () => req('/real/flatten', { method: 'POST', body: JSON.stringify({}) }),
  start: () => req('/start', { method: 'POST', body: JSON.stringify({}) }),
  performance: (window = '1w') => req(`/performance?window=${window}`),
  calendar: (days = 180) => req(`/calendar?days=${days}`),
  pnlAudit: () => req('/pnl-audit'),
  review: (hours = 24, book = null) => req(`/review?hours=${hours}&ai=0${book ? `&book=${book}` : ''}`),
  analyze: (symbols) => req(`/analyze?symbols=${encodeURIComponent(symbols.join(','))}`),
  connection: () => req('/connection'),
  exitPosition: (id) => req(`/positions/${id}/exit`, { method: 'POST', body: JSON.stringify({}) }),
  equitySeries: (range = '1d') => req(`/equity-series?range=${range}`),
  activity: (hours = 24) => req(`/activity?hours=${hours}`),
};
