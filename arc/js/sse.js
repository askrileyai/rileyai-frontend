// @ts-check
// Fetch-based SSE client. EventSource can't send X-Arc-Key, so we parse
// text/event-stream off a fetch ReadableStream ourselves. Exponential-backoff
// reconnect, 45s heartbeat watchdog, Page-Visibility economy mode (abort when
// hidden >60s; snapshot-refetch + reconnect on return).

import * as bus from './bus.js';
import { API_BASE, getKey, isSim } from './api.js';
import { applyEvent, hydrate } from './store.js';

let abort = null;
let backoff = 1000;
let watchdog = null;
let hiddenTimer = null;
let poll = null;
let wanted = false;

function setLink(status) { bus.emit('link', status); }

function resetWatchdog() {
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    // No bytes for 45s — assume a dead proxy connection and force-cycle.
    if (abort) abort.abort();
  }, 45000);
}

async function connect() {
  if (!wanted || isSim()) return;
  abort = new AbortController();
  setLink('relink');
  try {
    const res = await fetch(`${API_BASE}/arc/stream`, {
      headers: { 'X-Arc-Key': getKey(), 'Accept': 'text/event-stream' },
      signal: abort.signal,
    });
    if (res.status === 401 || res.status === 403) { setLink('offline'); bus.emit('auth', { lost: true }); return; }
    if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);

    setLink('linked');
    backoff = 1000;
    resetWatchdog();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      resetWatchdog();
      buf += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const dataLines = frame.split('\n').filter((l) => l.startsWith('data:'));
        if (!dataLines.length) continue; // heartbeat comment
        try {
          const evt = JSON.parse(dataLines.map((l) => l.slice(5).trim()).join('\n'));
          if (evt && evt.type) applyEvent(evt);
        } catch (_) {}
      }
    }
    throw new Error('stream ended');
  } catch (e) {
    if (!wanted || isSim()) return;
    setLink('offline');
    clearTimeout(watchdog);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 1.8, 30000);
  }
}

function onVisibility() {
  if (document.hidden) {
    hiddenTimer = setTimeout(() => { if (abort) abort.abort(); setLink('offline'); }, 60000);
  } else {
    clearTimeout(hiddenTimer);
    if (wanted && !isSim()) {
      hydrate().catch(() => {});
      if (!abort || abort.signal.aborted) connect();
    }
  }
}

export function start() {
  if (wanted) return;
  wanted = true;
  document.addEventListener('visibilitychange', onVisibility);
  // Authoritative resync every 20s — keeps stats/ledger/balance correct even if
  // the stream silently drops (common on mobile) or an event is missed.
  clearInterval(poll);
  poll = setInterval(() => { if (wanted && !isSim() && !document.hidden) hydrate().catch(() => {}); }, 20000);
  connect();
}

export function stop() {
  wanted = false;
  clearTimeout(watchdog);
  clearTimeout(hiddenTimer);
  clearInterval(poll);
  if (abort) abort.abort();
  setLink('offline');
}
