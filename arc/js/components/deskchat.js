// @ts-check
// DESK CHAT — Riley, docked next to the decision console.
//
// The console is observe-only on its own: you can watch her cut TSLA and read
// her one-line reason, but you can't ask "why that level?" or tell her "that
// felt early". This is the return path. Owner 08-04: "for the user to checkin
// with riley for everything the user sees and riley making the decision what to
// do, but the user giving insight on what they see or asking for an explanation."
//
// The point of it is `ask(evt)` — click any row in Mission Control and that
// decision loads here as context, so the question is about THAT arbitration /
// veto / bank rather than a cold prompt. POST /arc/chat/stream only takes
// {message, history}, so the context rides INSIDE the message and this needs no
// backend change.
//
// Deliberately NOT a second chat implementation: it reuses riley.js's
// richText()/humanizeMaybeJson() and the existing .msg-* CSS, and hands off to
// the full #/riley screen for anything long (that screen stays routable, it just
// left the nav).

import { API_BASE, getKey, isSim } from '../api.js';
import { esc } from './fmt.js';
import { richText, humanizeMaybeJson } from '../screens/riley.js?v=m45';

const MAX_HISTORY = 10;

/** Compact an engine event into something Riley can reason about. Deliberately
 *  small — the whole `data` blob is mostly plumbing ids, and the summary plus a
 *  few decision-bearing fields is what actually carries the reasoning. */
function contextOf(evt, sub) {
  if (!evt) return '';
  const d = evt.data || {};
  const bits = [`type: ${evt.type}`];
  if (evt.symbol) bits.push(`symbol: ${evt.symbol}`);
  if (evt.strategyKey) bits.push(`lane: ${evt.strategyKey}`);
  if (evt.summary) bits.push(`summary: ${evt.summary}`);
  if (sub) {
    bits.push(`your decision: ${sub.action} on ${sub.symbol} at conviction ${sub.conviction}`);
    if (sub.reason) bits.push(`your reason: ${sub.reason}`);
    if (sub.band) bits.push(`health band: ${sub.band}`);
    if (sub.pending) bits.push(`mechanical pending you ruled on: ${sub.pending}`);
  }
  if (d.gate) bits.push(`failed gate: ${d.gate}`);
  if (Array.isArray(d.gates) && d.gates.length) {
    const last = d.gates[d.gates.length - 1] || {};
    bits.push(`gates evaluated: ${d.gates.length}${last.pass === false ? ` (failed ${last.name}: ${last.value} vs ${last.limit})` : ' (all passed)'}`);
  }
  if (d.stage) bits.push(`stage: ${d.stage}`);
  const ranked = d.scores || d.contenders;
  if (Array.isArray(ranked)) bits.push(`lanes ranked: ${ranked.map((s) => `${s.strategy} ${s.score}`).join(', ')}`);
  if (d.winner) bits.push(`winner: ${d.winner}`);
  if (d.conviction != null) bits.push(`conviction: ${d.conviction}`);
  if (d.held) bits.push(`mechanical stop held: ${d.held}`);
  if (d.rule) bits.push(`machine rule overridden: ${d.rule}`);
  return bits.join('\n');
}

/** @returns {{ask(evt, sub):void, destroy():void}} */
/**
 * @param {HTMLElement} host
 * @param {{onThinking?: (active:boolean)=>void}} [opts]
 *        onThinking brackets a live question — the brain fires neurons for the
 *        duration so you can see her actually working on it.
 */
export function mountDeskChat(host, opts) {
  host.innerHTML = `
    <div class="dc-panel">
      <div class="dc-head">
        <span class="dc-dot"></span>
        <span class="dc-title">Ask Riley</span>
        <a class="dc-full" href="#/riley">Full chat</a>
      </div>
      <div class="dc-scroll" id="dc-scroll"></div>
      <div class="dc-ctx" id="dc-ctx" hidden></div>
      <form class="dc-bar" id="dc-bar">
        <input class="dc-in" id="dc-in" type="text" autocomplete="off"
               placeholder="Ask about a decision, or tell her what you see…" />
        <button class="dc-send" type="submit" aria-label="Send">↑</button>
      </form>
    </div>`;

  const scroll = host.querySelector('#dc-scroll');
  const input = host.querySelector('#dc-in');
  const form = host.querySelector('#dc-bar');
  const ctxEl = host.querySelector('#dc-ctx');

  const history = [];
  let pending = null;          // {evt, sub} — the decision this question is about
  let streaming = false;
  let abort = null;

  greet();
  function greet() {
    const row = document.createElement('div');
    row.className = 'dc-empty';
    row.textContent = 'Tap any decision to ask about it, or just type.';
    scroll.appendChild(row);
  }

  function bubble(role) {
    const empty = scroll.querySelector('.dc-empty'); if (empty) empty.remove();
    const row = document.createElement('div');
    row.className = `msg-row ${role === 'user' ? 'me' : 'riley'}`;
    row.innerHTML = '<div class="msg-bubble"><div class="msg-text"></div><div class="msg-tools"></div></div>';
    scroll.appendChild(row);
    scroll.scrollTop = scroll.scrollHeight;
    return row.querySelector('.msg-bubble');
  }
  const setText = (b, t) => { b.querySelector('.msg-text').innerHTML = richText(t); scroll.scrollTop = scroll.scrollHeight; };
  const setTools = (b, tools) => { b.querySelector('.msg-tools').innerHTML = (tools || []).map((t) => `<span class="msg-tool">⚙ ${esc(t)}</span>`).join(''); };

  function showCtx() {
    if (!pending) { ctxEl.hidden = true; ctxEl.textContent = ''; return; }
    const e = pending.evt;
    ctxEl.hidden = false;
    ctxEl.innerHTML = `<span class="dc-ctx-l">about</span> ${esc(pending.sub ? `${pending.sub.symbol} · ${pending.sub.action}` : `${e.symbol || e.type}`)}<button class="dc-x" type="button" aria-label="Clear">×</button>`;
    ctxEl.querySelector('.dc-x').onclick = () => { pending = null; showCtx(); };
  }

  async function send(text) {
    if (!text || streaming) return;
    const ctx = pending ? contextOf(pending.evt, pending.sub) : '';
    setText(bubble('user'), text);
    // The context is prepended to the MESSAGE (the endpoint takes no context
    // field), and history stores the bare question so the transcript reads clean.
    const wire = ctx ? `Here is the decision I'm asking about:\n${ctx}\n\nMy question: ${text}` : text;
    history.push({ role: 'user', content: text });
    pending = null; showCtx();
    input.value = '';

    const b = bubble('riley');
    setText(b, '…');
    streaming = true;
    host.querySelector('.dc-panel')?.classList.add('dc-busy');
    opts?.onThinking?.(true);
    try {
      if (isSim()) {
        // A beat, so sim behaves like a real turn — the busy state and the
        // brain's neurons actually get a chance to show.
        await new Promise((r) => setTimeout(r, 900));
        setText(b, ctx
          ? 'Sim mode — no live desk. With the backend connected I would explain that decision from the event you attached.'
          : 'Sim mode — connect the backend to talk to the real desk.');
      } else {
        await stream(b, wire);
      }
    } catch (e) {
      setText(b, `Couldn't reach the desk — ${e.message || e}`);
    } finally {
      streaming = false;
      host.querySelector('.dc-panel')?.classList.remove('dc-busy');
      opts?.onThinking?.(false);
    }
  }

  async function stream(b, message) {
    abort = new AbortController();
    const res = await fetch(`${API_BASE}/arc/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Arc-Key': getKey() },
      // readOnly: this dock is for questions and insight, never changes. The
      // backend refuses mutating tools outright rather than executing them.
      body: JSON.stringify({ message, history: history.slice(-MAX_HISTORY), readOnly: true }),
      signal: abort.signal,
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '';
    const tools = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let sep;
      while ((sep = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, sep); buf = buf.slice(sep + 2);
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        try {
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === 'text') { text += evt.content; setText(b, text); }
          else if (evt.type === 'tool') { tools.push(evt.label || evt.name); setTools(b, tools); }
        } catch (_) {}
      }
    }
    text = humanizeMaybeJson(text);
    setText(b, text || '(no reply)');
    history.push({ role: 'assistant', content: text });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value.trim()); });

  return {
    /** Load a decision as the subject of the next question. */
    ask(evt, sub) {
      pending = { evt, sub };
      showCtx();
      input.focus();
      if (!input.value) input.value = 'Why?';
      input.setSelectionRange(input.value.length, input.value.length);
    },
    destroy() { try { abort?.abort(); } catch (_) {} },
  };
}
