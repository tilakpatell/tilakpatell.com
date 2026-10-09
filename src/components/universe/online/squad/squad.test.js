import { afterEach, describe, expect, it, vi } from 'vitest';
import { schnorr } from '@noble/secp256k1';
import { hex, joinRoom } from '../nostr';
import { createRelays } from '../fakeRelays.testkit';
import { seal, sealKey, unseal } from '../chat/seal';
import { roomOf } from './invite';
import { APP_ID, createSquad } from './squad';

const URLS = ['wss://one.example', 'wss://two.example'];
const SID = 'BCDFGHJKLMNP';
const ROOM = 'tp-squad-room'; // (the room key's use, as squad.js draws it from the sid)
const SEALED = 12000;
const squads = [];

// Pilots on the fake relays, each on a key of their own, on one clock (the
// squads' ticks are the faked intervals: time passes a second at a time)
function sky() {
  const net = createRelays(URLS);
  let t = 1000;
  const fly = (name, { lead = false, keys = schnorr.keygen(), saved = null, keep = null } = {}) => {
    const load = () => Promise.resolve((opts, room) => joinRoom({ ...opts, relays: URLS, WebSocket: net.WebSocket, keys }, room));
    const s = createSquad({ sid: SID, lead, card: () => ({ name, kind: 'falcon', where: '/universe', shield: 100, level: 1, ready: false }), load, now: () => t, saved, keep });
    squads.push(s);
    return Object.assign(s, { keys, id: hex(keys.publicKey) });
  };
  const pass = (ms) => {
    for (let i = 0; i < ms; i += 1000) {
      t += 1000;
      vi.advanceTimersByTime(1000);
    }
  };
  // a client of someone's own in the squad's room (its topic is no secret), on the keys given
  const raw = async (keys) => {
    const r = joinRoom({ appId: APP_ID, relays: URLS, WebSocket: net.WebSocket, keys, cheap: new Set() }, await roomOf(SID));
    await r.ready;
    const z = r.makeAction('z');
    // [kind, data] into the room, sealed under the key given (by default the room's, from the sid)
    r.say = async (kind, data, key) => z.send(await seal(key ?? (await sealKey(SID, ROOM)), JSON.stringify([kind, data]), SEALED));
    return r;
  };
  return { net, fly, pass, raw };
}
// wait till fn() is true (signing, sealing, checking and the relays take real time)
const until = async (fn, ms = 3000) => {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
};
const settle = () => new Promise((r) => setTimeout(r, 30));
const seats = (s) => s.view().members.map((m) => [m.id, m.name, m.leader]);
const HELLO = { n: 'Biggs', k: 'falcon', w: '/universe', sh: 100, lv: 1, rd: 0, h: [] };
// three in one squad, Alpha leading
async function three() {
  const sk = sky();
  const a = sk.fly('Alpha', { lead: true });
  await until(() => a.status === 'online');
  const b = sk.fly('Bravo');
  const c = sk.fly('Charlie');
  // seated on their first hellos; then a second at a time, for the hellos that carry the names
  await until(() => [a, b, c].every((s) => s.view().members.length === 3));
  await until(() => (sk.pass(1000), [a, b, c].every((s) => s.view().members.every((m) => m.name))));
  return { ...sk, a, b, c };
}
// z messages from this pilot that have reached the first relay
const posted = (net, id) => net.relays[URLS[0]].log.filter((ev) => ev.pubkey === id).flatMap((ev) => JSON.parse(ev.content)).filter((m) => m[0] === 'z').length;

// A room of the test's own, no relays and nothing signed: what the squad
// sends is kept with the time it went (out() opens it), and the test speaks
// for everyone else, sealing as the room does (from(id, kind, data)). Its
// time passes half a second at a time, with a moment between for sealing.
const ME = 'a'.repeat(64);
const [L, A, B, J, X] = ['1', '2', '3', '4', 'e'].map((c) => c.repeat(64));
const doc = (patch = {}) => ({ n: 5, by: L, m: [L, ME], x: [], k: 0, o: 0, r: null, lb: null, i: null, ...patch });
async function bench({ ready = Promise.resolve(), ...opts } = {}) {
  const key = await sealKey(SID, ROOM);
  let t = 1000;
  const sent = [];
  const room = {
    selfId: ME,
    ready,
    left: false,
    acts: {},
    onStatus: null,
    makeAction(ns) {
      const a = { onMessage: null, send: (data) => (sent.push({ ns, data, t }), Promise.resolve()) };
      room.acts[ns] = a;
      return a;
    },
    leave() {
      room.left = true;
    },
  };
  const s = createSquad({ sid: SID, card: () => ({ name: 'Alpha', kind: 'falcon', where: '/universe', shield: 100, level: 1, ready: false }), load: () => Promise.resolve(() => room), now: () => t, ...opts });
  squads.push(s);
  return {
    s,
    room,
    get t() {
      return t;
    },
    out: () => Promise.all(sent.map(async (m) => ({ ns: m.ns, t: m.t, msg: JSON.parse(await unseal(key, m.data, SEALED)) }))),
    async from(id, kind, data) {
      room.acts.z.onMessage(await seal(key, JSON.stringify([kind, data]), SEALED), { peerId: id });
      await settle();
    },
    async pass(ms) {
      for (let i = 0; i < ms; i += 500) {
        t += 500;
        vi.advanceTimersByTime(500);
        await settle();
      }
    },
  };
}
const throwaway = (n) => Array.from({ length: n }, (_, i) => (i + 16).toString(16).padStart(64, '0'));

afterEach(() => {
  for (const s of squads.splice(0)) s.close();
  vi.useRealTimers();
});

describe('createSquad, on the relays', () => {
  it('three pilots end with one view', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c } = await three();
    expect(seats(b)).toEqual(seats(a));
    expect(seats(c)).toEqual(seats(a));
    expect(seats(a)[0]).toEqual([a.id, 'Alpha', true]);
    expect(seats(a).slice(1).map(([id]) => id).sort()).toEqual([b.id, c.id].sort());
    expect([a, b, c].map((s) => s.view().mine).sort()).toEqual([0, 1, 2]);
    for (const s of [a, b, c]) expect(s.view()).toMatchObject({ sid: SID, leader: a.id, gone: false, locked: false });
  });

  it('the leader leaving hands over at once', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c } = await three();
    const next = a.view().members[1].id;
    a.leave();
    expect(a.view()).toMatchObject({ gone: true, why: 'left' });
    await until(() => [b, c].every((s) => s.view().leader === next && s.view().members.length === 2));
    expect(seats(c)).toEqual(seats(b));
    expect(b.view().members.map((m) => m.id)).not.toContain(a.id);
  });

  it('kick removes, locks and keeps out', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c, fly, pass } = await three();
    a.kick(c.id);
    await until(() => c.view().gone && b.view().members.length === 2);
    expect(c.view().why).toBe('out');
    expect(b.view()).toMatchObject({ locked: true, members: [{ id: a.id }, { id: b.id }] });
    // back by the link again, on the same key: not seated, and told so once nothing has seated them in 15 s
    const again = fly('Charlie', { keys: c.keys });
    await until(() => again.status === 'online');
    await until(() => (pass(1000), again.view().gone));
    expect(again.view()).toMatchObject({ why: 'out', mine: null });
    expect(a.view().members.map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it('squadmates hear each other’s pings, phrases and lines, cleaned; nobody else is heard', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c, raw } = await three();
    const got = [];
    b.onPing = (ping, from) => got.push(['pg', from, ping]);
    b.onQuick = (i, from) => got.push(['qc', from, i]);
    b.onText = (text, from) => got.push(['ch', from, text]);
    expect(a.ping({ kind: 'go', where: '/universe', p: [10, 0, -20] })).toBe(true);
    expect(a.quick(6)).toBe(true);
    expect(a.text('regroup, see https://bad.example now‮')).toBe(true);
    await until(() => got.length === 3);
    expect(got).toContainEqual(['pg', a.id, { kind: 'go', where: '/universe', p: [10, 0, -20], sec: null, target: null }]);
    expect(got).toContainEqual(['qc', a.id, 6]);
    expect(got).toContainEqual(['ch', a.id, 'regroup, see [link] now']);
    // a squadmate's client of their own: what it says is cleaned once it's opened
    const out = await raw(c.keys);
    await out.say('ch', { t: 'go to evil . com ‮now' });
    await until(() => got.length === 4);
    expect(got[3]).toEqual(['ch', c.id, 'go to [link] now']);
    // turned out, they still have the sid, and the key it makes: not heard
    a.kick(c.id);
    await until(() => b.view().members.length === 2);
    await out.say('pg', { k: 'foe', w: '/universe' });
    await out.say('qc', 3);
    await out.say('ch', { t: 'let me back in' });
    // nor is a stranger with the sid who was never seated, nor junk from a squadmate
    const stranger = await raw(schnorr.keygen());
    await stranger.say('qc', 4);
    expect(a.ping({ kind: 'nuke', where: '/universe' })).toBe(false);
    expect(a.text('   ')).toBe(false);
    // (a word from a squadmate after all of them: by the time it's heard, they were all heard or dropped)
    a.quick(0);
    await until(() => got.length === 5);
    await settle();
    expect(got).toHaveLength(5);
    expect(got[4]).toEqual(['qc', a.id, 0]);
    out.leave();
    stranger.leave();
  });

  it('a reload picks the squad up from what it kept, and leaving forgets it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { fly, pass } = sky();
    let kept = null;
    const keep = (w) => (kept = w);
    const a = fly('Alpha', { lead: true, keep });
    await until(() => a.status === 'online');
    const b = fly('Bravo');
    await until(() => kept?.m.length === 2 && b.view().mine === 1);
    // the page goes (a reload: no goodbye), and comes back with what it kept
    a.close();
    const back = fly('Alpha', { keys: a.keys, saved: kept, keep });
    await until(() => back.status === 'online');
    expect(back.view()).toMatchObject({ leader: a.id, mine: 0, members: [{ id: a.id }, { id: b.id }] });
    pass(1000);
    await until(() => b.view().members[0].name === 'Alpha' && b.view().members[0].away === false);
    expect(b.view()).toMatchObject({ leader: a.id, mine: 1 });
    back.leave();
    expect(kept).toBeNull();
  });

  it('only a pilot with the sid says anything in the room: without it, whatever comes in its topic moves nothing and is never seated', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c, net, raw } = await three();
    const seated = [a.id, ...[b.id, c.id].sort((x, y) => a.view().members.findIndex((m) => m.id === x) - a.view().members.findIndex((m) => m.id === y))];
    const crafted = (by) => ({ n: 99, by, m: [by], x: [], k: 0, o: 0, r: null, lb: null, i: null });
    const other = await sealKey('ZXWVTSRQPNML', ROOM);
    // someone who read the topic off the relays, on a key of their own: plain words, words sealed under
    // another squad's key, or under this sid's key for another use, and junk
    const outsider = await raw(schnorr.keygen());
    const z = outsider.makeAction('z');
    z.send(JSON.stringify(['hi', HELLO]));
    await outsider.say('hi', HELLO, other);
    await outsider.say('doc', crafted(outsider.selfId), other);
    await outsider.say('hi', HELLO, await sealKey(SID));
    z.send('AAAA');
    z.send(42);
    // a squadmate's own client, under the wrong key: dropped too
    const own = await raw(b.keys);
    await own.say('doc', crafted(b.id), other);
    await until(() => posted(net, outsider.selfId) === 6 && posted(net, b.id) > 0);
    await settle();
    for (const s of [a, b, c]) expect(s.view().members.map((m) => m.id)).toEqual(seated);
    // and two with the sid meet: one more, with it, is seated
    const friend = await raw(schnorr.keygen());
    await friend.say('hi', HELLO);
    await until(() => [a, b, c].every((s) => s.view().members.length === 4));
    for (const s of [a, b, c]) expect(s.view().members.map((m) => m.id)).toEqual([...seated, friend.selfId]);
    for (const r of [outsider, own, friend]) r.leave();
  });

  it('what won’t open counts against the pilot who sent it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const sk = sky();
    const { fly, pass, raw } = sk;
    const a = fly('Alpha', { lead: true });
    await until(() => a.status === 'online');
    const r = await raw(schnorr.keygen());
    const wrong = await sealKey('ZXWVTSRQPNML', ROOM);
    for (let i = 0; i < 20; i++) await r.say('hi', HELLO, wrong);
    await r.say('hi', HELLO);
    await until(() => posted(sk.net, r.selfId) === 21);
    await settle();
    expect(a.view().members).toHaveLength(1); // (its allowance spent on what wouldn't open)
    pass(1000);
    await r.say('hi', HELLO);
    await until(() => a.view().members.length === 2);
    expect(a.view().members[1].id).toBe(r.selfId);
    r.leave();
  });

  it('the relays carry no callsign, no member id and no sid in what a squad says: who speaks is all they see', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c, net, pass } = await three();
    a.text('Alpha here, regroup');
    b.ping({ kind: 'help', where: '/universe', p: [1, 2, 3] });
    a.kick(c.id);
    pass(3000);
    await until(() => b.view().locked);
    const log = net.relays[URLS[0]].log;
    for (const s of [a, b, c]) expect(posted(net, s.id)).toBeGreaterThan(1); // (hellos and documents from each, a line, a ping)
    for (const ev of log) {
      const said = JSON.stringify([ev.content, ev.tags]);
      for (const secret of ['Alpha', 'Bravo', 'Charlie', 'regroup', SID, a.id, b.id, c.id]) expect(said.includes(secret), secret).toBe(false);
    }
    // (each event is signed by its pilot's key, as every event on the relays is)
    expect(new Set(log.map((ev) => ev.pubkey))).toEqual(new Set([a.id, b.id, c.id]));
  });
});

describe('createSquad, in a room of the test’s own', () => {
  const online = (b) => until(() => b.s.status === 'online');

  it('says hello every 1.5 s till seated, then every 3 s', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = await bench();
    await online(b);
    await settle();
    const t0 = b.t;
    await b.pass(6000);
    const hellos = async () => (await b.out()).filter((m) => m.msg[0] === 'hi').map((m) => m.t);
    expect(await hellos()).toEqual([t0, t0 + 1500, t0 + 3000, t0 + 4500, t0 + 6000]);
    await b.from(L, 'doc', doc());
    expect(b.s.view()).toMatchObject({ leader: L, mine: 1 });
    await b.pass(6000);
    expect((await hellos()).filter((t) => t > t0 + 6000)).toEqual([t0 + 9000, t0 + 12000]);
  });

  it('asking in on slow relays: the 15 s run from when the room is online', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let open;
    const b = await bench({ ready: new Promise((r) => (open = r)) });
    await b.pass(10000); // (the relays slow to answer)
    expect(b.s.view()).toMatchObject({ gone: false, members: [] });
    open();
    await online(b);
    await b.pass(14500);
    expect(b.s.view()).toMatchObject({ gone: false, mine: null });
    await b.pass(500);
    expect(b.s.view()).toMatchObject({ gone: true, why: 'quiet' });
  });

  it('asked in from the roster, hears only the inviter’s squad', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = await bench({ via: A });
    await online(b);
    await b.from(X, 'doc', doc({ by: X, m: [X, ME] }));
    expect(b.s.view()).toMatchObject({ leader: null, mine: null });
    await b.from(L, 'doc', doc({ m: [L, A, ME] }));
    expect(b.s.view()).toMatchObject({ leader: L, mine: 2 });
  });

  it('changes made at once go out as the newest document only', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = await bench({ lead: true });
    await online(b);
    await settle();
    const docs = async () => (await b.out()).filter((m) => m.msg[0] === 'doc').map((m) => m.msg[1]);
    const was = (await docs()).length;
    b.s.rally({ w: '/galaxy/hoth', p: null });
    b.s.open(true);
    b.s.lock(true);
    await settle();
    const now = (await docs()).slice(was);
    expect(now).toHaveLength(1);
    expect(now[0]).toMatchObject({ n: 4, by: ME, o: 1, k: 1, r: { w: '/galaxy/hoth', p: null } });
  });

  it('a room full of pilots heard lately still lets a new one be heard, and seated', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = await bench({ lead: true });
    await online(b);
    for (const id of [L, A, B]) await b.from(id, 'hi', HELLO);
    expect(b.s.view().members).toHaveLength(4);
    // 32 more with the sid, on keys of their own, saying hello: no seat for them
    for (const id of throwaway(32)) await b.from(id, 'hi', HELLO);
    await b.from(B, 'bye', null);
    await b.from(J, 'hi', HELLO);
    expect(b.s.view().members.map((m) => m.id)).toEqual([ME, L, A, J]);
  });

  it('no relay answering in time: failed, its ticks stopped and the room left, for good', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const ready = Promise.reject(new Error('no relay answered'));
    ready.catch(() => {});
    const b = await bench({ ready });
    await until(() => b.s.status === 'failed');
    expect(vi.getTimerCount()).toBe(0);
    expect(b.room.left).toBe(true);
    for (const s of ['connecting', 'online']) {
      b.room.onStatus?.(s);
      expect(b.s.status).toBe('failed');
    }
  });
});
