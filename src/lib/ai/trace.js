// The recorder: what every agent decided, kept small. A brain notes one
// record a think (its mode, action, phase, the scores `utility.pick`
// already returns, its belief of you, why an action was refused or cut)
// and the inspector reads the last few back, or a check saves the lot as
// JSON for a bug report. A ring per agent, so the memory is fixed however
// long the visit runs, and nothing reads it back into a decision, so
// tracing never changes the outcome. Pure, no three.js.
//
//   createTrace({ size = 600 }) → {
//     note(id, t, record)          a plain object; t is stored on a copy
//     last(id) → record | null
//     history(id, n = 20) → record[] (newest last)
//     agents() → id[]
//     clear(id?)                   one agent, or all of them
//     export() → { size, agents: { [id]: record[] } }
//   }
//
// 600 records at a 10 Hz think is a minute of an agent's mind.

export function createTrace({ size = 600 } = {}) {
  const cap = Math.max(1, Math.floor(size));
  // id → { buf, next, count }: a fixed array written round, so a note is
  // one store and no allocation past the copy of the record
  const rings = new Map();

  const ordered = (ring, n) => {
    const k = Math.min(n, ring.count);
    const out = new Array(k);
    for (let i = 0; i < k; i++) out[i] = ring.buf[(ring.next - k + i + cap) % cap];
    return out;
  };

  return {
    note(id, t, record) {
      let ring = rings.get(id);
      if (!ring) {
        ring = { buf: new Array(cap), next: 0, count: 0 };
        rings.set(id, ring);
      }
      // a copy, so the brain can reuse its scratch object next think
      ring.buf[ring.next] = { ...record, t };
      ring.next = (ring.next + 1) % cap;
      if (ring.count < cap) ring.count++;
    },
    last(id) {
      const ring = rings.get(id);
      return ring && ring.count ? ring.buf[(ring.next - 1 + cap) % cap] : null;
    },
    history(id, n = 20) {
      const ring = rings.get(id);
      return ring ? ordered(ring, n) : [];
    },
    agents() {
      return [...rings.keys()];
    },
    clear(id) {
      if (id === undefined) rings.clear();
      else rings.delete(id);
    },
    export() {
      const agents = {};
      // records are plain objects by contract; the round-trip strips
      // anything a caller slipped in that isn't (a function, a Map)
      for (const [id, ring] of rings) agents[id] = JSON.parse(JSON.stringify(ordered(ring, cap)));
      return { size: cap, agents };
    },
  };
}
