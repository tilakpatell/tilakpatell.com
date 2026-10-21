import { afterEach, describe, expect, it } from 'vitest';
import { schnorr } from '@noble/secp256k1';
import { KIND, checkEvent, hex, joinAsVisitor, joinRoom, setIdentity, signEvent, visitKeys } from './nostr';

// In-memory relays that behave like the real ones: they check each event's
// id and signature, answer OK, and pass it on to every matching listener
// (the sender included); a CLOSE ends one listening.
function createRelays(urls) {
  const relays = Object.fromEntries(urls.map((u) => [u, { clients: new Set(), down: false, log: [], reqs: [] }]));
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
      if (msg[0] === 'REQ') {
        this.subs.set(msg[1], msg[2]);
        this.relay?.reqs.push(msg);
      }
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
  // (a filter with '#g' passes only events tagged with one of its cells; one without, any)
  const inCells = (f, ev) => !f['#g'] || ev.tags.some((t) => t[0] === 'g' && f['#g'].includes(t[1]));
  const pass = (relay, ev) => {
    for (const c of relay.clients)
      for (const [id, f] of c.subs) if (f.kinds.includes(ev.kind) && ev.tags.some((t) => t[0] === 'x' && f['#x'].includes(t[1])) && inCells(f, ev)) c.deliver(['EVENT', id, ev]);
  };
  return {
    relays,
    WebSocket: FakeSocket,
    made: () => made, // sockets opened to the relays, all told
    // an event straight to the listeners, unchecked (a relay up to no good)
    inject: (url, ev) => pass(relays[url], ev),
    // an event to every listening, whatever its filter (a relay that ignores '#g')
    leak(url, ev) {
      for (const c of relays[url].clients) for (const [id] of c.subs) c.deliver(['EVENT', id, ev]);
    },
    setDown(url, down) {
      relays[url].down = down;
      if (down) for (const c of [...relays[url].clients]) c.close();
    },
  };
}

const URLS = ['wss://one.example', 'wss://two.example'];
const rooms = [];
const join = (net, opts = {}) => {
  const r = joinRoom({ appId: 'test-app', relays: URLS, WebSocket: net.WebSocket, ...opts }, 'room-1');
  const got = [];
  const joined = [];
  const left = [];
  for (const ns of ['hi', 'pose', 'shot', 'ally']) r.makeAction(ns).onMessage = (data, { peerId }) => got.push({ ns, data, from: peerId });
  r.onPeerJoin = (id) => joined.push(id);
  r.onPeerLeave = (id) => left.push(id);
  rooms.push(r);
  return Object.assign(r, { got, joined, left, action: (ns) => r.makeAction(ns) });
};
// wait till fn() is true (signing and checking take real time)
const until = async (fn, ms = 3000) => {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
};
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

afterEach(async () => {
  for (const r of rooms.splice(0)) await r.leave();
});

describe('joinRoom over Nostr relays', () => {
  it('pilots meet, and what one sends the other gets once, from whichever relay is first', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    const b = join(net);
    await Promise.all([a.ready, b.ready]);
    await until(() => a.joined.includes(b.selfId) && b.joined.includes(a.selfId));
    a.action('hi').send({ n: 'Han' });
    await until(() => b.got.some((m) => m.ns === 'hi'));
    await settle();
    expect(b.got.filter((m) => m.ns === 'hi')).toEqual([{ ns: 'hi', data: { n: 'Han' }, from: a.selfId }]);
  });

  it('sends real Nostr events: an ephemeral kind, tagged with the room and the visit, signed', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    await a.ready;
    a.action('hi').send({ n: 'Han' });
    await until(() => net.relays[URLS[0]].log.some((ev) => ev.content.includes('"hi"'))); // (bundled with the word that you're here)
    const visits = new Set();
    for (const ev of net.relays[URLS[0]].log) {
      expect(ev.kind).toBe(KIND);
      expect(ev.pubkey).toBe(a.selfId);
      expect(ev.tags[0]).toEqual(['x', 'test-app/room-1']);
      expect(ev.tags[1][0]).toBe('visit');
      visits.add(ev.tags[1][1]);
      expect(await checkEvent(ev)).toBe(true);
    }
    expect(visits.size).toBe(1); // (the same visit on all of them)
  });

  it('signs with the key it is handed: one for the visit, the same in every room', async () => {
    const net = createRelays(URLS);
    const keys = visitKeys();
    expect(visitKeys()).toBe(keys);
    const a = join(net, { keys });
    const other = joinRoom({ appId: 'test-app', relays: URLS, WebSocket: net.WebSocket, keys }, 'room-2');
    rooms.push(other);
    expect(a.selfId).toBe(hex(keys.publicKey));
    expect(other.selfId).toBe(a.selfId);
    const b = join(net);
    expect(b.selfId).not.toBe(a.selfId);
    await Promise.all([a.ready, b.ready]);
    a.action('hi').send({ n: 'Han' });
    await until(() => b.got.some((m) => m.ns === 'hi' && m.from === a.selfId));
  });

  it('signs as the pilot’s identity: the visit’s key is whatever identity.js gives', () => {
    const keys = schnorr.keygen();
    setIdentity({ keys: () => keys, ready: Promise.resolve(), remember: true, guest: false });
    try {
      expect(visitKeys()).toBe(keys);
      const net = createRelays(URLS);
      const r = joinAsVisitor({ appId: 'test-app', relays: URLS, WebSocket: net.WebSocket }, 'room-1');
      rooms.push(r);
      expect(r.selfId).toBe(hex(keys.publicKey));
    } finally {
      setIdentity(null); // (the page's own again, made when next asked)
    }
    expect(visitKeys()).not.toBe(keys);
  });

  it('rooms on the same relays share one socket to each, and a room that leaves stops listening', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    const b = join(net);
    const other = joinRoom({ appId: 'test-app', relays: URLS, WebSocket: net.WebSocket }, 'room-2');
    rooms.push(other);
    await Promise.all([a.ready, b.ready, other.ready]);
    expect(net.made()).toBe(URLS.length);
    const listening = () => [...net.relays[URLS[0]].clients].reduce((n, c) => n + c.subs.size, 0);
    expect(listening()).toBe(3);
    await other.leave();
    expect(listening()).toBe(2);
    // (and the two still in hear each other)
    a.action('hi').send({ n: 'Han' });
    await until(() => b.got.some((m) => m.ns === 'hi'));
  });

  it('a message for one pilot reaches only them', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    const b = join(net);
    const c = join(net);
    await until(() => a.joined.length === 2 && b.joined.length === 2 && c.joined.length === 2);
    a.action('ally').send({ t: 'ask' }, { target: b.selfId });
    await until(() => b.got.some((m) => m.ns === 'ally'));
    await settle();
    expect(c.got.some((m) => m.ns === 'ally')).toBe(false);
  });

  it('bundles what is waiting, keeping only the newest pose', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    const b = join(net);
    await until(() => b.joined.includes(a.selfId));
    for (let i = 1; i <= 5; i++) a.action('pose').send([i, 0, 0]);
    a.action('shot').send([1, 2, 3, 4, 5, 6]);
    await until(() => b.got.some((m) => m.ns === 'shot'));
    await settle();
    expect(b.got.filter((m) => m.ns === 'pose').map((m) => m.data)).toEqual([[5, 0, 0]]);
  });

  it('believes nothing that matters unless its signature checks out', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    const b = join(net);
    await until(() => b.joined.includes(a.selfId));
    // a hello "from a", signed by someone else, slipped in by a relay
    const { secretKey } = schnorr.keygen();
    const forged = await signEvent(secretKey, a.selfId, { tags: [['x', 'test-app/room-1']], content: JSON.stringify([['hi', { n: 'Imposter' }]]) });
    net.inject(URLS[0], forged);
    net.inject(URLS[1], { ...forged, content: JSON.stringify([['hi', { n: 'Imposter 2' }]]) }); // (its id no longer fits)
    await settle();
    expect(b.got.some((m) => m.ns === 'hi')).toBe(false);
  });

  it('drops an event far older than the pilot’s others (an old one played back)', async () => {
    const net = createRelays(URLS);
    const b = join(net);
    await b.ready;
    const { secretKey, publicKey } = schnorr.keygen();
    const x = hex(publicKey);
    const tags = [['x', 'test-app/room-1']];
    const t = Math.floor(Date.now() / 1000);
    net.inject(URLS[0], await signEvent(secretKey, x, { tags, content: JSON.stringify([['hi', { n: 'Now' }]]), created_at: t }));
    net.inject(URLS[0], await signEvent(secretKey, x, { tags, content: JSON.stringify([['hi', { n: 'Old' }]]), created_at: t - 120 }));
    await until(() => b.got.some((m) => m.data.n === 'Now'));
    await settle();
    expect(b.got.map((m) => m.data.n)).toEqual(['Now']);
  });

  it('an event from a past visit, played back first, is dropped', async () => {
    const net = createRelays(URLS);
    const b = join(net);
    await b.ready;
    // (a pilot whose key lasts: what they said a day ago, captured, played back before anything of theirs today)
    const { secretKey, publicKey } = schnorr.keygen();
    const x = hex(publicKey);
    const tags = [['x', 'test-app/room-1']];
    const t = Math.floor(Date.now() / 1000);
    net.inject(URLS[0], await signEvent(secretKey, x, { tags, content: JSON.stringify([['hi', { n: 'Yesterday' }]]), created_at: t - 86400 }));
    net.inject(URLS[0], await signEvent(secretKey, x, { tags, content: JSON.stringify([['hi', { n: 'Yesterday again' }]]), created_at: t - 86390 }));
    await settle();
    expect(b.got).toEqual([]);
    expect(b.joined).toEqual([]);
    // and what they say today is taken
    net.inject(URLS[0], await signEvent(secretKey, x, { tags, content: JSON.stringify([['hi', { n: 'Today' }]]), created_at: t }));
    await until(() => b.got.some((m) => m.data.n === 'Today'));
    expect(b.got.map((m) => m.data.n)).toEqual(['Today']);
  });

  it('a goodbye from a past visit doesn’t remove a pilot who’s here', async () => {
    const net = createRelays(URLS);
    const keys = schnorr.keygen(); // (a key that lasts: the same pilot, visit after visit)
    const first = joinRoom({ appId: 'test-app', relays: URLS, WebSocket: net.WebSocket, keys }, 'room-1');
    rooms.push(first);
    await first.ready;
    await settle(); // (the goodbye's signed ahead)
    await first.leave();
    const isBye = (ev) => ev.pubkey === first.selfId && ev.content.includes('@bye');
    await until(() => net.relays[URLS[0]].log.some(isBye)); // (the relay checks it first)
    const goodbye = net.relays[URLS[0]].log.find(isBye);
    // the next visit, on the same key, met by someone who wasn't there for the first
    const c = join(net);
    const again = joinRoom({ appId: 'test-app', relays: URLS, WebSocket: net.WebSocket, keys }, 'room-1');
    rooms.push(again);
    await until(() => c.joined.includes(again.selfId));
    await settle();
    net.inject(URLS[0], goodbye); // (the old goodbye, played back)
    await settle();
    expect(c.left).toEqual([]);
    // and this visit's own goodbye still does
    await settle();
    await again.leave();
    await until(() => c.left.includes(again.selfId));
  });

  it('says when a pilot leaves', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    const b = join(net);
    await until(() => b.joined.includes(a.selfId));
    await settle(); // (the goodbye's signed ahead)
    await a.leave();
    await until(() => b.left.includes(a.selfId));
  });

  it('keeps going on one relay when the other is down', async () => {
    const net = createRelays(URLS);
    net.setDown(URLS[0], true);
    const a = join(net);
    const b = join(net);
    await Promise.all([a.ready, b.ready]);
    await until(() => b.joined.includes(a.selfId));
    a.action('hi').send({ n: 'Han' });
    await until(() => b.got.some((m) => m.ns === 'hi'));
  });

  it('says it could not connect when no relay answers, and comes back when one does', async () => {
    const net = createRelays(URLS);
    for (const u of URLS) net.setDown(u, true);
    const a = join(net, { readyMs: 200 });
    const statuses = [];
    a.onStatus = (s) => statuses.push(s);
    await expect(a.ready).rejects.toThrow();
    net.setDown(URLS[1], false);
    await until(() => statuses.includes('online'), 4000); // (it tries again, a second on)
  });
});

describe('a room heard by cell', () => {
  const reqs = (net) => net.relays[URLS[0]].reqs;
  const gOf = (ev) => ev.tags.filter((t) => t[0] === 'g').map((t) => t[1]);

  it('a room joined without cells asks for exactly what it always did', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    await a.ready;
    const [req] = reqs(net);
    expect(req[0]).toBe('REQ');
    expect(Object.keys(req[2])).toEqual(['kinds', '#x', 'since']);
    expect(req[2]).toEqual({ kinds: [KIND], '#x': ['test-app/room-1'], since: expect.any(Number) });
    a.action('hi').send({ n: 'Han' });
    await until(() => net.relays[URLS[0]].log.some((ev) => ev.content.includes('"hi"')));
    for (const ev of net.relays[URLS[0]].log) expect(gOf(ev)).toEqual([]);
  });

  it('asks for its cells, says its own, and asks again only when the set changes', async () => {
    const net = createRelays(URLS);
    const a = join(net, { cells: () => ['hoth/0,0', 'hoth/1,0'] });
    a.setCell('hoth/0,0');
    await a.ready;
    expect(reqs(net)).toHaveLength(1);
    expect(reqs(net)[0][2]).toEqual({ kinds: [KIND], '#x': ['test-app/room-1'], '#g': ['hoth/0,0', 'hoth/1,0'], since: expect.any(Number) });
    a.action('hi').send({ n: 'Han' });
    await until(() => net.relays[URLS[0]].log.some((ev) => ev.content.includes('"hi"')));
    for (const ev of net.relays[URLS[0]].log) expect(gOf(ev)).toEqual(['hoth/0,0']);
    a.setCells(['hoth/1,0', 'hoth/0,0']); // (the same set: the relays count REQs)
    await settle(20);
    expect(reqs(net)).toHaveLength(1);
    a.setCells(['hoth/1,0', 'hoth/2,0']);
    await settle(20); // (asked on the next tick, once however often it's said in a frame)
    expect(reqs(net)).toHaveLength(2);
    expect(reqs(net)[1][1]).toBe(reqs(net)[0][1]); // (under the same id: it replaces the first)
    expect(reqs(net)[1][2]['#g']).toEqual(['hoth/1,0', 'hoth/2,0']);
  });

  it('a relay that drops asks, when it’s back, for the cells of the moment', async () => {
    const net = createRelays(URLS);
    const a = join(net, { cells: () => ['hoth/0,0'] });
    await a.ready;
    net.setDown(URLS[0], true);
    await settle(20); // (the socket's closed, and waiting to try again)
    a.setCells(['hoth/7,7']);
    net.setDown(URLS[0], false);
    join(net); // (a room joining tries a relay that's down at once)
    const mine = () => reqs(net).filter((r) => r[1] === reqs(net)[0][1]);
    await until(() => mine().length === 2);
    expect(mine()[1][2]['#g']).toEqual(['hoth/7,7']);
  });

  it('a pilot crossing into the next cell is heard by a watcher round both, not by one round the old', async () => {
    const net = createRelays(URLS);
    const a = join(net, { cells: () => ['hoth/0,0'] });
    a.setCell('hoth/0,0');
    const both = join(net, { cells: () => ['hoth/0,0', 'hoth/1,0'] });
    const old = join(net, { cells: () => ['hoth/0,0'] });
    await Promise.all([a.ready, both.ready, old.ready]);
    a.action('pose').send([1, 0, 0]);
    await until(() => both.got.some((m) => m.ns === 'pose') && old.got.some((m) => m.ns === 'pose'));
    a.setCell('hoth/1,0');
    a.setCells(['hoth/1,0', 'hoth/0,0']);
    a.action('pose').send([2049, 0, 0]);
    await until(() => both.got.some((m) => m.ns === 'pose' && m.data[0] === 2049));
    await settle();
    expect(both.got.filter((m) => m.ns === 'pose').map((m) => m.data[0])).toEqual([1, 2049]);
    expect(old.got.filter((m) => m.ns === 'pose').map((m) => m.data[0])).toEqual([1]);
  });

  it('hands on the cell a word was tagged with, the sender’s own, so a reader can hold a pose to it', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    a.setCell('hoth/2,3');
    const b = join(net);
    const tags = [];
    for (const ns of ['pose', 'hi']) b.makeAction(ns).onMessage = (data, { tag }) => tags.push([ns, tag]);
    await Promise.all([a.ready, b.ready]);
    a.action('pose').send([5000, 0, 7000]);
    await until(() => tags.some(([ns]) => ns === 'pose'));
    expect(tags.find(([ns]) => ns === 'pose')[1]).toBe('hoth/2,3');
    // (a room whose pilots say no cell hands on none)
    const c = join(net);
    await c.ready;
    c.action('hi').send({ n: 'Han' });
    await until(() => tags.some(([ns]) => ns === 'hi'));
    expect(tags.find(([ns]) => ns === 'hi')[1]).toBeNull();
  });

  it('a message for a pilot cells away carries their cell, so it passes their filter', async () => {
    const net = createRelays(URLS);
    const a = join(net); // (hears everyone)
    a.setCell('hoth/0,0');
    const b = join(net, { cells: () => ['hoth/5,5'] });
    b.setCell('hoth/5,5');
    await Promise.all([a.ready, b.ready]);
    b.action('pose').send([10240, 0, 10240]);
    await until(() => a.got.some((m) => m.ns === 'pose' && m.from === b.selfId));
    a.action('ally').send({ t: 'ask' }, { target: b.selfId });
    await until(() => b.got.some((m) => m.ns === 'ally'));
    const sent = net.relays[URLS[0]].log.find((ev) => ev.pubkey === a.selfId && ev.content.includes('"ally"'));
    expect(gOf(sent)).toEqual(['hoth/0,0', 'hoth/5,5']);
    // and what isn't for them, from cells away, they don't hear
    a.action('hi').send({ n: 'Han' });
    await settle();
    expect(b.got.some((m) => m.ns === 'hi')).toBe(false);
  });

  it('a pilot’s goodbye carries the cell they’re in, so those round them hear they’ve gone', async () => {
    const net = createRelays(URLS);
    const a = join(net, { cells: () => ['hoth/0,0'] });
    a.setCell('hoth/3,3');
    const b = join(net, { cells: () => ['hoth/0,0'] });
    await Promise.all([a.ready, b.ready]);
    await settle(); // (the goodbye's signed ahead, in 3,3)
    a.setCell('hoth/0,0'); // (and signed again for the cell they're in now)
    a.action('hi').send({ n: 'Han' }); // (a word that's checked: a goodbye is believed only after one)
    await until(() => b.got.some((m) => m.ns === 'hi'));
    await settle();
    await a.leave();
    await until(() => b.left.includes(a.selfId));
  });

  it('setCells with nothing, after none, asks nothing again (all is all)', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    await a.ready;
    a.setCells([]);
    a.setCells(null);
    await settle(20);
    expect(reqs(net)).toHaveLength(1);
  });

  it('setCells many times in a frame asks each relay once, and not at all when it ends where it began', async () => {
    const net = createRelays(URLS);
    const a = join(net, { cells: () => ['hoth/0,0'] });
    await a.ready;
    for (let i = 1; i <= 5; i++) a.setCells([`hoth/${i},0`]);
    await settle(20);
    expect(reqs(net)).toHaveLength(2);
    expect(reqs(net)[1][2]['#g']).toEqual(['hoth/5,0']);
    a.setCells(['hoth/9,9']);
    a.setCells(['hoth/5,0']);
    await settle(20);
    expect(reqs(net)).toHaveLength(2);
  });

  it('an event from a cell not listened for (a relay that ignores #g, or a REQ not yet replaced) is dropped and counted', async () => {
    const net = createRelays(URLS);
    const b = join(net, { cells: () => ['hoth/0,0'] });
    await b.ready;
    const { secretKey, publicKey } = schnorr.keygen();
    const x = hex(publicKey);
    const say = (g, n) => signEvent(secretKey, x, { tags: [['x', 'test-app/room-1'], ...(g ? [['g', g]] : [])], content: JSON.stringify([['hi', { n }]]) });
    net.leak(URLS[0], await say('hoth/9,9', 'Far'));
    net.leak(URLS[0], await say(null, 'Nowhere'));
    await settle();
    expect(b.got).toEqual([]);
    expect(b.stats().offCell).toBe(2);
    net.leak(URLS[0], await say('hoth/0,0', 'Near'));
    await until(() => b.got.some((m) => m.data.n === 'Near'));
    expect(b.stats().offCell).toBe(2);
  });

  it('a message for a pilot whose cell isn’t known goes out with the sender’s own', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    a.setCell('hoth/0,0');
    const b = join(net);
    await until(() => a.joined.includes(b.selfId) && b.joined.includes(a.selfId));
    a.action('ally').send({ t: 'ask' }, { target: b.selfId });
    await until(() => b.got.some((m) => m.ns === 'ally'));
    const sent = net.relays[URLS[0]].log.find((ev) => ev.pubkey === a.selfId && ev.content.includes('"ally"'));
    expect(gOf(sent)).toEqual(['hoth/0,0']);
  });

  it('a message for a pilot whose words carry no cell goes as it always did', async () => {
    const net = createRelays(URLS);
    const a = join(net);
    const b = join(net);
    await until(() => a.joined.includes(b.selfId) && b.joined.includes(a.selfId));
    a.action('ally').send({ t: 'ask' }, { target: b.selfId });
    await until(() => b.got.some((m) => m.ns === 'ally'));
    const sent = net.relays[URLS[0]].log.find((ev) => ev.pubkey === a.selfId && ev.content.includes('"ally"'));
    expect(gOf(sent)).toEqual([]);
  });
});

describe('a party’s chat on the room’s own key', () => {
  const PARTY = '0123456789abcdef';

  it('a line one room seals for another opens there, on their keys, and nowhere else', async () => {
    const net = createRelays(URLS);
    const [a, b, c] = [join(net), join(net), join(net)];
    const blobs = await a.seal([b.selfId], PARTY, 'Meet at Bree');
    expect(blobs).toHaveLength(1);
    expect(await b.open(a.selfId, PARTY, blobs)).toBe('Meet at Bree');
    expect(await c.open(a.selfId, PARTY, blobs)).toBe(null);
    expect(await b.open(a.selfId, 'fedcba9876543210', blobs)).toBe(null);
  });

  it('junk is null, not a throw, and a room that’s left seals and opens nothing', async () => {
    const net = createRelays(URLS);
    const [a, b] = [join(net), join(net)];
    expect(await a.seal('everyone', PARTY, 'Hi')).toBe(null);
    expect(await b.open(a.selfId, PARTY, [() => 'not a blob'])).toBe(null);
    const blobs = await a.seal([b.selfId], PARTY, 'Hi');
    await b.leave();
    expect(await b.open(a.selfId, PARTY, blobs)).toBe(null);
    await a.leave();
    expect(await a.seal([b.selfId], PARTY, 'Hi')).toBe(null);
  });
});
