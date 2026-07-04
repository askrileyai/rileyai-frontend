// @ts-check
// Tiny pub/sub. Topics: 'evt' (decision events), 'state' (store snapshots),
// 'link' (sse status), 'alert' (theme), 'route' (screen changes).
const topics = new Map();

export function on(topic, fn) {
  if (!topics.has(topic)) topics.set(topic, new Set());
  topics.get(topic).add(fn);
  return () => topics.get(topic)?.delete(fn);
}

export function emit(topic, payload) {
  const subs = topics.get(topic);
  if (!subs) return;
  for (const fn of subs) {
    try { fn(payload); } catch (e) { console.error('[bus]', topic, e); }
  }
}
