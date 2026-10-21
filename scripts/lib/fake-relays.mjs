// The Nostr relays, faked, for the browser checks (online-check.mjs,
// flyto-check.mjs, and the squad check after them): Playwright's
// routeWebSocket answers every wss:// a page opens from here, in Node, so
// two or three browser contexts meet with no network at all, and CI can run
// the checks. RELAY=fake in the environment has a check attach it to each
// context it makes, in place of the public relays (or BRIDGE's way to them).
//
// One relay for each host, as the real ones are (the page's pool opens one
// socket to each of nostr.js's four). Each keeps every socket's listening
// (a REQ, by its id; a CLOSE ends one) and passes every EVENT to each
// listening whose kinds, #x and #g (when it asks by cell) match, on every socket of every context
// attached, the sender's own included, as the real relays do; the sender
// gets an OK. Nothing is kept for later (the site's events are ephemeral),
// and no signature is checked: the pages check what matters themselves.
//
// fakeRelays() → { attach(context) (a promise: awaited before the
// context's first page opens a socket), publish(event) (one from the check
// itself, to every relay: the flight check's extra pilots), contents() (what
// the events sent so far carried, the last 5,000: the party check reads it
// for a line of chat in the clear) }

export function fakeRelays() {
  const relays = new Map(); // host → Set of sockets: { subs: Map(id → filter), send(msg) }
  const carried = [];
  const relayOf = (url) => {
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      /* (not an address: one relay of its own) */
    }
    if (!relays.has(host)) relays.set(host, new Set());
    return relays.get(host);
  };
  const matches = (f, ev) =>
    Boolean(f) &&
    Array.isArray(f.kinds) &&
    f.kinds.includes(ev.kind) &&
    Array.isArray(f['#x']) &&
    Array.isArray(ev.tags) &&
    ev.tags.some((t) => Array.isArray(t) && t[0] === 'x' && f['#x'].includes(t[1])) &&
    // (a single-letter tag is indexed by a real relay, NIP-01: asked by cell, only those cells)
    (!Array.isArray(f['#g']) || ev.tags.some((t) => Array.isArray(t) && t[0] === 'g' && f['#g'].includes(t[1])));
  const pass = (relay, ev) => {
    for (const s of [...relay]) for (const [id, f] of s.subs) if (matches(f, ev)) s.send(['EVENT', id, ev]);
  };

  return {
    attach(context) {
      return context.routeWebSocket(/^wss:\/\//, (ws) => {
        const relay = relayOf(ws.url());
        const socket = {
          subs: new Map(),
          send(msg) {
            try {
              ws.send(JSON.stringify(msg));
            } catch {
              relay.delete(socket); // (its page is gone)
            }
          },
        };
        relay.add(socket);
        ws.onMessage((m) => {
          let msg;
          try {
            msg = JSON.parse(typeof m === 'string' ? m : String(m));
          } catch {
            return;
          }
          if (!Array.isArray(msg)) return;
          if (msg[0] === 'REQ' && typeof msg[1] === 'string') socket.subs.set(msg[1], msg[2]);
          else if (msg[0] === 'CLOSE') socket.subs.delete(msg[1]);
          else if (msg[0] === 'EVENT' && msg[1] && typeof msg[1] === 'object') {
            const ev = msg[1];
            if (typeof ev.content === 'string') carried.push(ev.content);
            if (carried.length > 5000) carried.shift();
            socket.send(['OK', typeof ev.id === 'string' ? ev.id : '', true, '']);
            pass(relay, ev);
          }
        });
        ws.onClose(() => relay.delete(socket));
      });
    },
    contents: () => [...carried],
    publish(ev) {
      for (const relay of relays.values()) pass(relay, ev);
    },
  };
}
