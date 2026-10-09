import { afterEach, describe, expect, it } from 'vitest';
import { schnorr } from '@noble/secp256k1';
import { KIND, checkEvent, hex, joinAsVisitor, joinRoom, setIdentity, signEvent, visitKeys } from './nostr';
// (in-memory relays that check, answer and pass events on as the real ones do)
import { createRelays } from './fakeRelays.testkit';

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
