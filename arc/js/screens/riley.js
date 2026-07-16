// @ts-check
// RILEY — the conversational control + advisory surface. Talk to Riley about
// the account, positions, and the autonomous engine; ask it to set things up.
// Real mode streams from POST /api/arc/chat/stream (SSE, tool-use agent).
// Sim mode uses a local responder that reads the synthetic engine state, so
// the tab is fully demoable with no backend.

import { state, winRate, RISK_PRESETS } from '../store.js';
import * as bus from '../bus.js';
import { API_BASE, getKey, isSim } from '../api.js';
import { simKill, simResume } from '../sim.js';
import { readFor, ideaFor, bestIdeas } from '../analysis.js';
import { money, pnlClass, esc } from '../components/fmt.js';

let msgs = []; // {role:'user'|'riley', text, tools?:[]}
let streaming = false;

// Preloaded suggestion chips removed (owner 07-15) — the input stands alone.
const SUGGESTS = [];

export function mount(host) {
  host.innerHTML = `
    <div class="chat">
      <div class="chat-scroll" id="c-scroll"></div>
      <div>
        ${SUGGESTS.length ? `<div class="chat-suggests" id="c-suggests">${SUGGESTS.map((s) => `<button class="fchip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        <div class="chat-input">
          <textarea id="c-input" placeholder="Ask Riley about your account, or tell it what to set up…" rows="1"></textarea>
          <button class="btn" id="c-send">Send</button>
        </div>
      </div>
    </div>
  `;

  const scroll = host.querySelector('#c-scroll');
  if (!msgs.length) {
    pushRiley(scroll, greeting());
  } else {
    render(scroll);
  }

  const input = host.querySelector('#c-input');
  const send = host.querySelector('#c-send');
  // Prefill from the Strategies "New strategy" button.
  if (window.__arcChatPrefill) { input.value = window.__arcChatPrefill; window.__arcChatPrefill = null; }
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; };
  input.addEventListener('input', autosize);
  autosize();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  send.addEventListener('click', submit);
  host.querySelectorAll('#c-suggests .fchip').forEach((b) => {
    b.addEventListener('click', () => { input.value = b.getAttribute('data-s'); submit(); });
  });

  function submit() {
    const text = input.value.trim();
    if (!text || streaming) return;
    input.value = ''; autosize();
    msgs.push({ role: 'user', text });
    render(scroll);
    respond(scroll, text);
  }
}

export function unmount() {}

function greeting() {
  return `Hi — I'm Riley, running your autonomous desk. I can explain what the engine is doing, review your positions, and set things up for you (strategies, risk limits, 0DTE, and more). Once you tell me to go, I run it hands-free. What do you want to look at?`;
}

function render(scroll) {
  scroll.innerHTML = '';
  for (const m of msgs) {
    if (m.role === 'user') {
      const el = document.createElement('div');
      el.className = 'msg user';
      el.textContent = m.text;
      scroll.appendChild(el);
    } else {
      appendRiley(scroll, m);
    }
  }
  scroll.scrollTop = scroll.scrollHeight;
}

function appendRiley(scroll, m) {
  const row = document.createElement('div');
  row.className = 'chat-riley-row';
  row.innerHTML = `<div class="chat-avatar"><span class="dot"></span>RILEY</div>`;
  const bubble = document.createElement('div');
  bubble.className = 'msg riley';
  const textEl = document.createElement('span');
  textEl.className = 'msg-text';
  textEl.innerHTML = richText(m.text || '');
  bubble.appendChild(textEl);
  const toolsEl = document.createElement('span');
  toolsEl.className = 'msg-tools';
  if (m.tools && m.tools.length) toolsEl.innerHTML = m.tools.map((t) => `<span class="msg-tool">⚙ ${esc(t)}</span>`).join('');
  bubble.appendChild(toolsEl);
  row.appendChild(bubble);
  scroll.appendChild(row);
  scroll.scrollTop = scroll.scrollHeight;
  return bubble; // has .msg-text and .msg-tools children
}

// Safety net: sometimes the agent finalizes with a raw JSON blob instead of
// prose. Rather than print braces at the user, pull out the human field (or
// flatten to readable lines). Applied only at stream END (partial JSON mid-
// stream must not be parsed). Non-JSON text passes straight through.
function humanizeMaybeJson(s) {
  const t = (s || '').trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return s;
  try {
    const o = JSON.parse(t);
    if (typeof o === 'string') return o;
    for (const k of ['reply', 'response', 'answer', 'message', 'text', 'content', 'thesis', 'summary', 'note', 'read']) {
      if (o && typeof o[k] === 'string' && o[k].trim()) return o[k];
    }
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      const parts = Object.entries(o)
        .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
        .map(([k, v]) => `**${k}:** ${v}`);
      if (parts.length) return parts.join('\n');
    }
  } catch (_) {}
  return s;
}

// Escape, then render **bold** and newlines — Riley's analysis reads cleanly.
function richText(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
function setBubbleText(bubble, text) { bubble.querySelector('.msg-text').innerHTML = richText(text); }
function setBubbleTools(bubble, tools) {
  bubble.querySelector('.msg-tools').innerHTML = (tools || []).map((t) => `<span class="msg-tool">⚙ ${esc(t)}</span>`).join('');
}

function pushRiley(scroll, text, tools) {
  msgs.push({ role: 'riley', text, tools });
  appendRiley(scroll, msgs[msgs.length - 1]);
}

async function respond(scroll, text) {
  streaming = true;
  const typing = document.createElement('div');
  typing.className = 'chat-typing';
  typing.textContent = 'Riley is thinking…';
  scroll.appendChild(typing);
  scroll.scrollTop = scroll.scrollHeight;

  try {
    if (isSim()) {
      await new Promise((r) => setTimeout(r, 500));
      const { text: reply, tools } = simReply(text);
      typing.remove();
      // stream the reply for feel
      await streamInto(scroll, reply, tools);
    } else {
      typing.remove();
      await realStream(scroll, text);
    }
  } catch (e) {
    typing.remove();
    pushRiley(scroll, `(Connection issue: ${e.message}. In simulation mode I still work offline.)`);
  } finally {
    streaming = false;
  }
}

async function streamInto(scroll, fullText, tools) {
  const m = { role: 'riley', text: '', tools: tools || [] };
  msgs.push(m);
  const bubble = appendRiley(scroll, m);
  const words = fullText.split(' ');
  for (let i = 0; i < words.length; i++) {
    m.text += (i ? ' ' : '') + words[i];
    setBubbleText(bubble, m.text);
    scroll.scrollTop = scroll.scrollHeight;
    await new Promise((r) => setTimeout(r, 18));
  }
}

// Real SSE stream from the backend agent (Task C wires the endpoint).
async function realStream(scroll, text) {
  const m = { role: 'riley', text: '', tools: [] };
  msgs.push(m);
  const bubble = appendRiley(scroll, m);
  const res = await fetch(`${API_BASE}/arc/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Arc-Key': getKey() },
    body: JSON.stringify({ message: text, history: msgs.slice(-12).map((x) => ({ role: x.role === 'user' ? 'user' : 'assistant', content: x.text })) }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
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
        if (evt.type === 'text') { m.text += evt.content; setBubbleText(bubble, m.text); }
        else if (evt.type === 'tool') { m.tools.push(evt.label || evt.name); setBubbleTools(bubble, m.tools); }
        scroll.scrollTop = scroll.scrollHeight;
      } catch (_) {}
    }
  }
  m.text = humanizeMaybeJson(m.text);
  setBubbleText(bubble, m.text);
}

// ---- local demo brain (sim mode): reads AND controls the engine state ----
function simReply(q) {
  const t = q.toLowerCase();
  const open = state.positions || [];
  const day = Number(state.todayPnl || 0) + Number(state.unrealized || 0);
  const enabled = (state.strategies || []).filter((s) => s.enabled);

  // ---- CONTROL: Riley can drive the whole app from chat ----
  // Navigate.
  const nav = { overview: 'bridge', dashboard: 'bridge', research: 'research', 'look up': 'research', watchlist: 'research', positions: 'positions', blotter: 'positions', strateg: 'playbook', playbook: 'playbook', settings: 'armory', config: 'armory', performance: 'performance' };
  if (/(open|go to|show me|take me to|pull up|navigate)/.test(t)) {
    for (const [k, route] of Object.entries(nav)) if (t.includes(k)) { setTimeout(() => { location.hash = '#/' + route; }, 400); return { text: `Opening ${k}.`, tools: [`navigate: ${route}`] }; }
  }
  // Risk appetite.
  if (/(more )?(conservative|aggressive|balanced|cautious|safe|risky)/.test(t) && /(risk|trade|be|go|make|play)/.test(t)) {
    const ap = /aggress|risk(?!\s*appetite)|more risk/.test(t) ? 'aggressive' : /conservat|cautious|safe/.test(t) ? 'conservative' : 'balanced';
    state.mandate = { ...(state.mandate || {}), riskAppetite: ap };
    Object.assign(state.engine.risk_config, RISK_PRESETS[ap] || {});
    bus.emit('state', state);
    return { text: `Set to ${ap}. That means ${money(state.engine.risk_config.maxPerTradeUsd, { dp: 0 })} risk per trade, a ${money(state.engine.risk_config.maxDailyLossUsd, { dp: 0 })} daily stop, and up to ${state.engine.risk_config.maxOpenPositions} positions at once. You can see it in Settings.`, tools: [`riskAppetite: ${ap}`] };
  }
  // Trade permissions.
  const permWord = (w) => /crypto|bitcoin|btc|eth/.test(w) ? 'crypto' : /0dte|zero.?dte|same.?day/.test(w) ? 'zerodte' : /option/.test(w) ? 'options' : /stock|equit|share/.test(w) ? 'stocks' : null;
  if (/(enable|turn on|allow|start trading|let.*trade|trade)\s/.test(t) && permWord(t) && !/strateg/.test(t)) {
    const perm = permWord(t); state.permissions = { ...(state.permissions || {}), [perm]: true }; bus.emit('state', state);
    return { text: `${perm === 'zerodte' ? '0DTE options' : perm[0].toUpperCase() + perm.slice(1)} enabled. ${perm === 'zerodte' ? "I'll keep the hard flat-by-3:45pm rule and a tight cap — it's high-gamma." : perm === 'options' ? "Riley can now trade calls, puts and spreads." : ''} Toggle it any time in Settings.`, tools: [`enable: ${perm}`] };
  }
  if (/(disable|turn off|stop|no more|don.t)\s/.test(t) && permWord(t)) {
    const perm = permWord(t); state.permissions = { ...(state.permissions || {}), [perm]: false }; bus.emit('state', state);
    return { text: `Turned ${perm === 'zerodte' ? '0DTE' : perm} off — I won't trade it.`, tools: [`disable: ${perm}`] };
  }
  // Toggle / arm a strategy by name.
  const findStrat = () => (state.strategies || []).find((s) => t.includes((s.name || '').toLowerCase().split(' ·')[0].toLowerCase()) || t.includes(s.strategy_key.replace(/_/g, ' ')) || (/signature|7.?dim/.test(t) && s.flagship));
  if (/(turn on|enable|activate|arm|turn off|disable|pause|stop)\s.+(strateg|signature|momentum|reversion|breakout|spread|theta|0dte|discretion)/.test(t)) {
    const s = findStrat();
    if (s) {
      const on = /(turn on|enable|activate|arm)/.test(t);
      s.enabled = on; bus.emit('state', state);
      return { text: `${on ? 'Armed' : 'Paused'} ${s.name}. ${on ? "It's in SHADOW — say \"go live\" on it when you're ready." : ''}`, tools: [`${on ? 'enable' : 'disable'}: ${s.strategy_key}`] };
    }
  }
  // Go live on a strategy.
  if (/go live|make.*live|trade.*real|real money/.test(t)) {
    const s = findStrat() || enabled[0];
    if (s) { s.mode = 'LIVE'; s.enabled = true; bus.emit('state', state);
      return { text: `${s.name} is set to LIVE. Heads up: it only places real orders once the global LIVE switch in Settings → Danger zone is also on. I keep that off until you flip it, on purpose.`, tools: [`mode LIVE: ${s.strategy_key}`] }; }
  }
  // Halt / kill / resume.
  if (/(stop|halt|pause).*(everything|trading|engine|all)|emergency|panic/.test(t)) { simKill(1, 'chat'); return { text: `Done — engine halted. No new trades; your protective exits stay active. Say "resume" when you want me back on.`, tools: ['killSwitch: L1'] }; }
  if (/flatten|close everything|sell everything|get me out/.test(t)) { simKill(3, 'chat'); return { text: `Flattening everything and halting. All positions closed, all orders cancelled.`, tools: ['killSwitch: L3'] }; }
  if (/^resume|resume trading|start.*engine|get back|turn.*back on/.test(t)) { simResume(); return { text: `Back online — resuming the engine.`, tools: ['resume'] }; }
  // Set a raw limit.
  const limitMatch = t.match(/(daily loss|per trade|max.*loss|risk per trade|position).{0,12}?\$?\s*([\d,]+)/);
  if (limitMatch && /set|change|make|cap|limit/.test(t)) {
    const val = Number(limitMatch[2].replace(/,/g, ''));
    const key = /daily/.test(limitMatch[1]) ? 'maxDailyLossUsd' : /position/.test(limitMatch[1]) ? 'maxOpenPositions' : 'maxPerTradeUsd';
    if (Number.isFinite(val)) { state.engine.risk_config[key] = val; bus.emit('state', state);
      return { text: `Set ${key === 'maxDailyLossUsd' ? 'the daily loss cap' : key === 'maxOpenPositions' ? 'max positions' : 'risk per trade'} to ${key === 'maxOpenPositions' ? val : money(val, { dp: 0 })}. It's live in Settings → Guardrails.`, tools: [`setLimit ${key}=${val}`] }; }
  }
  // Add to watchlist.
  const wlAdd = t.match(/(add|watch|track)\s+([a-z]{1,5})\b/);
  if (wlAdd && /watch|track|add/.test(t)) {
    const sym = wlAdd[2].toUpperCase();
    if (!(state.watchlist || []).includes(sym)) { state.watchlist = [...(state.watchlist || []), sym]; bus.emit('state', state); }
    return { text: `Added ${sym} to your watchlist — it's on the Research tab. Want my read on it?`, tools: [`watchlist +${sym}`] };
  }

  // ---- HEDGE-FUND ANALYSIS + IDEAS ----
  // Best play / idea / opportunity right now → top institutional structure(s).
  if (/(best|top|favou?rite|highest.?conviction|give me).*(play|idea|trade|setup|opportunit|structure)|what should i (trade|buy|do)|find.*(trade|play|opportunit)/.test(t)) {
    const ideas = bestIdeas(state.watchlist, 3);
    if (!ideas.length) return { text: `Add a few names to your watchlist (Research tab) and I'll rank the best structures across them.` };
    const top = ideas[0];
    const rest = ideas.slice(1, 3).map((i) => `• ${i.symbol} ${i.name} (${Math.round(i.conviction * 100)}%) — ${i.tag}`).join('\n');
    return {
      text: `My highest-conviction idea right now: **${top.symbol} — ${top.name}** (${Math.round(top.conviction * 100)}%).\n\n${top.thesis}\n\nStructure: ${top.structure}\nRisk/reward: ${top.riskReward}\n\nRunners-up:\n${rest}\n\nWant me to deploy the ${top.name} on ${top.symbol}?`,
      tools: ['scanIdeas', `topIdea: ${top.symbol} ${top.name}`],
    };
  }
  // Analyze a specific stock — full institutional read.
  const anaSym = (q.match(/\b([A-Z]{1,5})\b/) || [])[1];
  if (/(analy|read on|what.?s|look at|thoughts on|break down|deep.?dive)/.test(t) && anaSym && anaSym.length <= 5 && !/strateg|goal/.test(t)) {
    const d = readFor(anaSym), idea = ideaFor(d);
    return {
      text: `${d.say}\n\nStructure read — bias ${d.biasLabel}, momentum ${d.mom}, IV rank ${d.ivRank}. Levels: support ${money(d.support)}, resistance ${money(d.resistance)}.\n\nMy play: **${idea.name}** — ${idea.thesis} ${idea.structure} (${idea.riskReward}).\n\nSay the word and I'll set it up.`,
      tools: [`analyze: ${anaSym}`],
    };
  }
  // Market analysis — institutional macro read.
  if (/(market|macro|overall|breadth|regime|conditions|environment).*(analy|read|look|doing|think)|analyze the market|market analysis/.test(t)) {
    return {
      text: `Market read: regime is BULL_LOW_VOL — VIX ~13, SPY in an orderly uptrend, breadth healthy (most names above their 20-day). Rich premium in single-names (elevated IV rank) favors selling defined-risk spreads over buying naked premium. Playbook right now: bull put spreads on strong names pulling to support, iron condors on the range-bound ones, and keep the Signature 7-dimension read leading. No high-impact econ prints in the blackout window. I'd stay constructive but sell premium rather than chase.`,
      tools: ['marketRead'],
    };
  }
  // Deploy a named structure (from Best Ideas or by name).
  if (/(deploy|set ?up|run|do) (the |a |an )?(iron condor|bull put|call debit|bear call|strangle|straddle|collar|wheel|credit spread|protective)/.test(t)) {
    const name = (q.match(/iron condor|bull put spread|call debit spread|bear call spread|long strangle|straddle|collar|the wheel|wheel|credit spread|protective put/i) || ['a defined-risk structure'])[0];
    const sym = anaSym || 'SPY';
    const strat = createStrategy(sym, `${name} — ${q}`, name);
    return { text: `Setting up the ${name} on ${sym} and adding it to your engine as "${strat.name}". It starts in SHADOW so you can watch it work, sized to your risk limits. Say "go live on ${sym}" when you want it real.`, tools: [`deployStructure: ${name}`, `createStrategy: ${strat.strategy_key}`] };
  }
  // Hedge the portfolio.
  if (/hedge|protect.*(portfolio|account|position|downside)|insurance|collar my|tail risk/.test(t)) {
    return {
      text: `Smart. With the account net-long, the cleanest hedge is a portfolio collar: buy SPY puts ~5% out for downside insurance and finance them by selling SPY calls ~5% up. That caps a drawdown while barely costing anything. For a sharper tail hedge I'd add a small VIX call or SPY put ratio. Want me to put the collar on sized to your equity?`,
      tools: ['proposeHedge: collar'],
    };
  }

  // Set a GOAL / mandate — Riley configures the system toward it.
  if (/(my goal|i want to (make|earn|grow|turn)|aim (for|to)|target of|grow.*account|make.*\$|per (week|month|day))/.test(t) && !/strateg/.test(t)) {
    state.mandate = state.mandate || {};
    state.mandate.goal = q.trim();
    bus.emit('state', state);
    return {
      text: `Locked in as your mandate: "${q.trim()}". Here's how I'll pursue it — I'll lean on the Signature 7-dimension read and mean-reversion for steady base hits, keep risk at your current appetite, and scale up only as the account grows. You can watch progress on the Overview track record. Want me to go more aggressive, add options income, or keep it as-is?`,
      tools: ['setGoal'],
    };
  }
  // Full autonomy — let Riley hunt the whole market.
  if (/(full auto|take over|hunt|do everything|be autonomous|handle everything|find the best|search.*(stocks|market|opportunit))/.test(t)) {
    state.mandate = { ...(state.mandate || {}), autonomy: 'full' };
    state.permissions = { ...(state.permissions || {}), marketWide: true };
    bus.emit('state', state);
    return {
      text: `You've got it — I'm on full autonomy now. I'll scan the whole market (not just your watchlist) for the best stock and options setups, size everything to your risk limits, and trade them hands-free. You'll see every decision in Activity and can hit the kill switch anytime. I'll keep the Signature read leading and rotate strategies to fit conditions.`,
      tools: ['setAutonomy: full', 'enableMarketWide'],
    };
  }
  // Formulate a NEW strategy for any stock, and add it to the engine.
  if (/(formulate|create|build|make|design|come up with|add).*(strateg|setup|system)|new strateg/.test(t)) {
    const sym = (q.match(/\b([A-Z]{1,5})\b/) || [])[1] || pickWord(q) || 'SPY';
    const created = createStrategy(sym, q);
    return {
      text: `Done — I've built a strategy for ${sym} and added it to your Strategies list:\n\n"${created.name}" — ${created.thesis}\n\nIt's off and in SHADOW so it proves out risk-free first. Watch it in Strategies, and say "go live on ${sym}" when you're happy. Want me to tune the entry, stop, or size?`,
      tools: [`createStrategy: ${created.strategy_key}`],
    };
  }
  if (/(delete|remove|kill|drop|get rid).*(strateg|setup)/.test(t)) {
    const custom = state.strategies.filter((s) => s.custom);
    const target = custom.find((s) => t.includes(s.symbol?.toLowerCase?.() || ' ') || t.includes((s.name || '').toLowerCase()));
    if (!custom.length) return { text: `You don't have any custom strategies to delete right now — the built-in ones (like Riley Signature) stay. You can toggle those off in Strategies instead.` };
    const victim = target || custom[custom.length - 1];
    state.strategies = state.strategies.filter((s) => s.strategy_key !== victim.strategy_key);
    bus.emit('state', state);
    return { text: `Removed "${victim.name}" from the engine.`, tools: [`deleteStrategy: ${victim.strategy_key}`] };
  }
  if (/signature|7.?dimension|seven.?dimension|your.*(strateg|brain)|how.*you.*(trade|decide|read)/.test(t)) {
    return { text: `My signature strategy is the one I run on my own read of the tape. For any stock I pull the full picture across seven dimensions — support & resistance (with how many times each level held), volume vs its average, order flow, candle patterns, market structure (higher-highs/lower-lows), momentum, and the classic indicators (RSI, MACD, Bollinger) across timeframes. I only take a trade when enough of those line up into a high-conviction setup, size it to your risk limits, and set the stop and target off the levels. It's the same brain the RileyAI app uses to analyze charts — now it trades for you.`, tools: ['riley_signature'] };
  }
  if (/win.?rate|track record|how.*am i.*doing|winning|losing|stats|percentage/.test(t)) {
    const wr = winRate();
    const rec = state.record || { wins: 0, losses: 0, closedPnl: 0 };
    return { text: `Your track record: ${wr != null ? Math.round(wr * 100) + '% win rate' : 'no closed trades yet'} — ${rec.wins} winners, ${rec.losses} losers, ${money(rec.closedPnl, { sign: true, dp: 0 })} realized. Right now you have ${open.length} open position${open.length === 1 ? '' : 's'}, session P&L ${money(day, { sign: true })}. It's all on the Overview, updating live as trades close.` };
  }

  if (/position|holding|how.*doing|p&l|pnl|profit|losing/.test(t)) {
    if (!open.length) return { text: `You're flat right now — no open positions. Session P&L is ${money(day, { sign: true })}. The engine is scanning and will open a position when a setup clears every risk gate.` };
    const lines = open.map((p) => {
      const m = state.marks[p.id] || {};
      return `• ${p.symbol}: ${p.direction.toUpperCase()} ${p.quantity} @ ${money(p.entry_price)}, now ${m.mark != null ? money(m.mark) : '—'} (${m.pnl != null ? money(m.pnl, { sign: true }) : '—'}) — via ${p.strategy_key}`;
    }).join('\n');
    return { text: `You have ${open.length} open position${open.length > 1 ? 's' : ''}, session P&L ${money(day, { sign: true })}:\n\n${lines}\n\nWant me to tighten stops, take profits, or leave the engine to manage them?` };
  }
  if (/engine.*doing|what.*happening|status|going on/.test(t)) {
    return { text: `Engine is ${state.engine.state}. ${enabled.length} strateg${enabled.length === 1 ? 'y' : 'ies'} armed (${enabled.map((s) => s.name || s.strategy_key).join(', ') || 'none'}), all in SHADOW right now so nothing is placing real orders. I'm scanning the pool every minute and only act when a setup passes the risk checks. Session P&L is ${money(day, { sign: true })}.` };
  }
  if (/which strateg|favou?r|like.*today|rotate|how do you (pick|choose|decide)|different strateg|best strateg/.test(t)) {
    const reg = state.regime;
    const auto = state.mandate?.autonomy || 'guided';
    const favored = (state.strategies || []).filter((s) => s.enabled && Number(s.arbiter_weight ?? 1) >= 0.9).map((s) => s.name || s.strategy_key);
    const stood = (state.strategies || []).filter((s) => s.enabled && Number(s.arbiter_weight ?? 1) === 0).map((s) => (s.name || s.strategy_key).split(' ·')[0]);
    return {
      text: `${reg ? `The situation right now is ${reg.label} (VIX ~${reg.vix}). ${reg.read}` : "I match the strategy to the situation."}\n\n${favored.length ? `Favoring: ${favored.join(', ')}.` : ''}${stood.length ? ` Stood down: ${stood.join(', ')}.` : ''}\n\nThat's the whole idea — ${auto === 'full' ? "in Full Auto I hunt the whole market and rotate the arsenal automatically as conditions change" : "I only run the strategies you've armed, but I still weight them to fit the tape"}. You control which strategies are in play in the Strategies tab; I pick the best one for each moment.`,
      tools: ['marketRead', 'situationMatch'],
    };
  }
  if (/0dte|zero.?dte|same.?day/.test(t)) {
    return { text: `Sure. I'll arm the 0DTE momentum strategy on SPY/QQQ with a tight per-trade cap and a hard flat-by-3:45pm rule — 0DTE is high-gamma so the guardrails matter. I'll start it in SHADOW so you can watch it prove out before it trades real money. Say "go live on 0DTE" when you're ready.`, tools: ['enable0DTE', 'setStrategy: zero_dte_momentum'] };
  }
  if (/risk|safe|protect|lose|kill|stop.*loss|limit/.test(t)) {
    const r = state.engine.risk_config || {};
    return { text: `Your safety rails: max ${money(r.maxPerTradeUsd || 100, { dp: 0 })} risk per trade, ${money(r.maxDailyLossUsd || 300, { dp: 0 })} daily-loss cap (I auto-halt if it's hit), max ${r.maxOpenPositions || 5} open positions, and no trading around major economic releases. There's a kill switch on the Overview with three levels — halt, cancel orders, or flatten everything. Every order passes 13 checks before it's placed.` };
  }
  if (/withdraw|deposit|money|cash|fund|bank/.test(t)) {
    return { text: `I can move money on Alpaca — deposits are straightforward. Withdrawals to your bank I'll always ask you to confirm by typing the amount, since that's irreversible. How much did you want to move, and which direction?` };
  }
  if (/mean reversion|momentum|explain|how does|what is/.test(t)) {
    return { text: `Mean reversion buys panic — when a liquid name gets oversold at the lower Bollinger band with RSI washed out, I take a long expecting it to snap back to the middle band. Momentum breakout is the opposite: I buy strength when price breaks a 20-bar high on heavy volume. The AI layer decides which one fits the current market and sizes accordingly. Want me to walk through any of them in more detail?` };
  }
  return { text: `Got it. In the live system I'd pull that from your account and the engine and act on it. For now (simulation), try: "how's my track record?", "formulate a strategy for TSLA", "which strategy do you like today?", "set up 0DTE on SPY", or "how does your signature strategy work?".` };
}

// Build a plausible custom strategy for a symbol (sim). Real mode: the backend
// agent turns the conversation into a stored custom-strategy spec.
function createStrategy(symbol, prompt, explicitName) {
  const styles = [
    { n: 'Pullback-to-VWAP', th: `buys ${symbol} on a pullback to VWAP in an uptrend, stop under the low of day, target the prior high` },
    { n: 'Breakout-Retest', th: `waits for ${symbol} to break a key level, then buys the retest that holds, 2R target` },
    { n: 'RSI-Divergence', th: `takes ${symbol} long when price makes a lower low but RSI makes a higher low, into a support level` },
    { n: 'Opening-Range', th: `trades ${symbol}'s first 15-minute range break with volume confirmation, flat by midday` },
  ];
  const isOption = !!explicitName;
  const s = styles[Math.floor((prompt.length + symbol.length) % styles.length)];
  const name = explicitName ? `${symbol} · ${explicitName}` : `${symbol} · ${s.n}`;
  const thesis = explicitName
    ? `${explicitName} on ${symbol} — a defined-risk options structure sized to your risk limits, managed to profit target and stop.`
    : `Custom strategy: ${s.th}. Sized to your risk limits.`;
  const key = `custom_${symbol.toLowerCase()}_${Date.now().toString(36).slice(-4)}`;
  const strat = {
    strategy_key: key, name, custom: true, symbol,
    thesis, tickClass: isOption ? 'scheduled' : 'intraday', enabled: false, mode: 'SHADOW', arbiter_weight: 1,
    stats: { pnl: 0, winRate: 0, trades: 0 },
  };
  state.strategies = [...state.strategies, strat];
  bus.emit('state', state);
  return strat;
}

function pickWord(q) {
  const m = q.match(/trade\s+([a-zA-Z]{1,5})/i) || q.match(/for\s+([a-zA-Z]{1,5})\b/i);
  return m ? m[1].toUpperCase() : null;
}
