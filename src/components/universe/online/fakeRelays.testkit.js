// In-memory relays for the tests (nostr.test.js, squad/squad.test.js), not
// for the site: nothing outside a test imports this, and its name isn't a
// test's, so Vitest doesn't run it as one. They behave like the real ones:
// they check each event's id and signature, answer OK, and pass it on to
// every matching listener (the sender included); a CLOSE ends one listening.
//
// createRelays(urls) → { relays (by url: { clients, down, log }), WebSocket
// (the class to hand joinRoom), made() → sockets opened so far, inject(url,
// ev) (an event straight to the listeners, unchecked: a relay up to no
// good), setDown(url, down) }

import { checkEvent } from './events';

export function createRelays(urls) {
  const relays = Object.fromEntries(urls.map((u) => [u, { clients: new Set(), down: false, log: [] }]));
  let made = 0;
  class FakeSocket {
    constructor(url) {
      made += 1;
      this.relay = relays[url];
      this.readyState = 0;
      this.subs = new Map();
      setTimeout(() => {
        if (!this.relay || this.relay.down) {
          this.readyState = 3;
          this.onclose?.();
          return;
        }
        this.readyState = 1;
        this.relay.clients.add(this);
        this.onopen?.();
      }, 0);
    }
    deliver(msg) {
      setTimeout(() => this.readyState === 1 && this.onmessage?.({ data: JSON.stringify(msg) }), 0);
    }
    send(s) {
      const msg = JSON.parse(s);
      if (msg[0] === 'REQ') this.subs.set(msg[1], msg[2]);
      if (msg[0] === 'CLOSE') this.subs.delete(msg[1]);
      if (msg[0] !== 'EVENT') return;
      const ev = msg[1];
      checkEvent(ev).then((ok) => {
        this.deliver(['OK', ev.id, ok, ok ? '' : 'invalid: bad signature']);
        if (!ok) return;
        this.relay.log.push(ev);
        pass(this.relay, ev);
      });
    }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.relay?.clients.delete(this);
      setTimeout(() => this.onclose?.(), 0);
    }
  }
  const pass = (relay, ev) => {
    for (const c of relay.clients)
      for (const [id, f] of c.subs) if (f.kinds.includes(ev.kind) && ev.tags.some((t) => t[0] === 'x' && f['#x'].includes(t[1]))) c.deliver(['EVENT', id, ev]);
  };
  return {
    relays,
    WebSocket: FakeSocket,
    made: () => made, // sockets opened to the relays, all told
    // an event straight to the listeners, unchecked (a relay up to no good)
    inject: (url, ev) => pass(relays[url], ev),
    setDown(url, down) {
      relays[url].down = down;
      if (down) for (const c of [...relays[url].clients]) c.close();
    },
  };
}
