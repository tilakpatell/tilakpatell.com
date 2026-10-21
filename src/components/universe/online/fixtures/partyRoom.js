// The room partyLink.test.js plays a party in: each pilot’s link, wired as
// client.js wires it, in memory and at once, with a clock the test moves.
// A fixture, kept apart so the test of the link stays a size one can read.

import { createPartyLink } from '../partyLink';

export const flush = () => new Promise((r) => setTimeout(r, 0));

// A line sealed by naming who it’s for (partyCrypt.js’s sealing has tests of
// its own): a blob is [from, to, party, text], base64url, as the wire wants.
export const blob = (v) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(v)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unblob = (s) => {
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
};
export const crypt = (me) => ({
  seal: async (to, party, text) => to.map((id) => blob([me, id, party, text])),
  open: async (from, party, blobs) => blobs.map(unblob).find((x) => Array.isArray(x) && x[0] === from && x[1] === me && x[2] === party)?.[3] ?? null,
});

// A room in memory, as client.js has it: each pilot’s link and the rows it
// keeps of the others (client.js’s peers: a name once their hello’s read,
// blocked or not), what one sends reaching the others at once, a hello said
// again whenever the party it names or its epoch changes (as client.js
// does), and admit as client.js’s: known, and not blocked. Each party a
// pilot starts has an id of its own (the first one’s every byte the pilot’s
// number).
export function createRoom() {
  let t = 1000;
  const pilots = new Map();
  const sent = []; // everything said: { from, ns, data, to }
  const deliver = (from, ns, data, to) => {
    sent.push({ from, ns, data, to: to ?? null });
    for (const o of [...pilots.values()]) {
      if (o.id === from || (to && to !== o.id)) continue;
      o.actions[ns]?.onMessage?.(JSON.parse(JSON.stringify(data)), { peerId: from });
    }
  };
  const said = (a) => JSON.stringify(a.link.helloField());
  const hello = (a) => {
    a.said = said(a);
    for (const o of [...pilots.values()]) {
      if (o === a) continue;
      const row = o.peers.get(a.id) ?? { id: a.id, name: null, where: null, blocked: false, ally: 'none', mate: false, pt: null, quip: null };
      o.peers.set(a.id, row);
      if (row.blocked) continue;
      const first = row.name === null;
      row.name = a.self.name;
      row.where = a.self.where;
      o.link.hello(row, { n: a.self.name, w: a.self.where, ...a.link.helloField() }, first);
    }
  };
  const join = (id, name, { store = null, where = '/universe', sealed = true } = {}) => {
    const n = pilots.size + 1;
    const a = { id, self: { id: null, name, where }, peers: new Map(), actions: {}, seen: [], said: null, wired: false };
    const emit = (e) => {
      a.seen.push(e);
      if (e.type === 'party' && a.wired && said(a) !== a.said) hello(a);
    };
    let made = 0;
    a.link = createPartyLink({ self: a.self, peers: a.peers, emit, feed: (text, tone) => a.seen.push({ type: 'feed', text, tone }), roster: () => a.seen.push({ type: 'roster' }), now: () => t, store, rand: (bytes) => bytes.fill(n + 16 * made++), date: () => 1.7e12 + t });
    a.self.id = id;
    pilots.set(id, a);
    a.link.wire({
      action: (ns) => (a.actions[ns] = { onMessage: null, send: (data, opts) => (deliver(id, ns, data, opts?.target), Promise.resolve()) }),
      admit: (kind, from) => {
        const p = a.peers.get(from);
        return p && !p.blocked ? p : null;
      },
    });
    a.wired = true;
    if (sealed) a.link.setCrypt(crypt(id));
    return a;
  };
  return {
    join,
    sent,
    hello,
    meet: () => [...pilots.values()].forEach(hello),
    // gone from the room (offline, or quiet too long): the others drop them
    gone(id) {
      pilots.delete(id);
      for (const o of pilots.values()) {
        const row = o.peers.get(id);
        if (!row) continue;
        o.peers.delete(id);
        o.link.gone(row);
      }
    },
    // a word straight from `from` (a pilot with a link or none), to one or all
    say: (from, ns, data, to) => deliver(from, ns, data, to),
    tick: (ms) => (t += ms),
  };
}
// heartbeats: the clock on, each link’s tick, and everyone’s hello
export const beat = (room, pilots, n = 3) => {
  for (let i = 0; i < n; i++) {
    room.tick(15000);
    for (const x of pilots) x.link.tick();
    room.meet();
  }
};
// a pilot closing the tab: the link let go (the party kept), and gone from the room
export const close = (room, x) => {
  x.link.dispose();
  room.gone(x.id);
};
