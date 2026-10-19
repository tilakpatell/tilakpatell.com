import { describe, expect, it } from 'vitest';
import { createPartyLink } from './partyLink';
import { createPartyStore } from './partyStore';
import { CHAT_MAX } from './partyWire';
import { QUIP_MS } from './quips';

// (a pilot's id is their key: 64 hex digits)
const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO] = ['a', 'b', 'c', 'd', 'e'].map((x) => x.repeat(64));
const flush = () => new Promise((r) => setTimeout(r, 0));

// A line sealed by naming who it's for (partyCrypt.js's sealing has tests of
// its own): a blob is [from, to, party, text], base64url, as the wire wants.
const blob = (v) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(v)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unblob = (s) => {
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
};
const crypt = (me) => ({
  seal: async (to, party, text) => to.map((id) => blob([me, id, party, text])),
  open: async (from, party, blobs) => blobs.map(unblob).find((x) => Array.isArray(x) && x[0] === from && x[1] === me && x[2] === party)?.[3] ?? null,
});

// A room in memory, as client.js has it: each pilot's link and the rows it
// keeps of the others (client.js's peers: a name once their hello's read,
// blocked or not), what one sends reaching the others at once, a hello said
// again whenever the party it names changes (as client.js does), and
// admit as client.js's: known, and not blocked.
function createRoom() {
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
  const hello = (a) => {
    a.said = a.link.helloField().pt ?? null;
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
      if (e.type === 'party' && a.wired && (a.link.helloField().pt ?? null) !== a.said) hello(a);
    };
    a.link = createPartyLink({ self: a.self, peers: a.peers, emit, feed: (text, tone) => a.seen.push({ type: 'feed', text, tone }), roster: () => a.seen.push({ type: 'roster' }), now: () => t, store, rand: (bytes) => bytes.fill(n), date: () => 1.7e12 + t });
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

const feeds = (a) => a.seen.filter((e) => e.type === 'feed').map((e) => e.text);
const chats = (a) => a.seen.filter((e) => e.type === 'chat').map((e) => e.line);
const ids = (a) => a.link.snapshot().party?.members.map((m) => m.id) ?? null;
const pidOf = (a) => a.link.helloField().pt;

// Alpha leads, Bravo in (and Charlie, for three), everyone here
function twoOf(opts = {}) {
  const room = createRoom();
  const a = room.join(ALPHA, 'Alpha', opts.a);
  const b = room.join(BRAVO, 'Bravo', opts.b);
  room.meet();
  a.link.api.invite(BRAVO);
  b.link.api.accept(ALPHA);
  return { room, a, b };
}
function threeOf(opts = {}) {
  const { room, a, b } = twoOf(opts);
  const c = room.join(CHARLIE, 'Charlie', opts.c);
  room.meet();
  a.link.api.invite(CHARLIE);
  c.link.api.accept(ALPHA);
  return { room, a, b, c };
}

describe('a party, started and joined', () => {
  it('starts one led by you, named in your hello', () => {
    const a = createRoom().join(ALPHA, 'Alpha');
    expect(a.link.helloField()).toEqual({});
    expect(a.link.snapshot()).toEqual({ party: null, invites: [], follow: false });
    expect(a.link.api.start()).toBe(true);
    expect(a.link.snapshot().party).toEqual({ id: '0101010101010101', leader: ALPHA, epoch: 1, members: [{ id: ALPHA, name: 'Alpha', since: 1.7e12 + 1000, present: true, where: '/universe', leader: true, you: true }] });
    expect(a.link.helloField()).toEqual({ pt: '0101010101010101' });
    expect(a.link.api.start()).toBe(false); // (one at a time)
    expect(a.seen).toContainEqual({ type: 'party' });
  });

  it('an invite said yes to: both in it, mates, each told', () => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha');
    const b = room.join(BRAVO, 'Bravo');
    room.meet();
    expect(a.link.api.invite(BRAVO)).toBe(true); // (no party yet: one's started, Alpha leading)
    const pid = pidOf(a);
    expect(b.link.snapshot().invites).toEqual([{ from: ALPHA, name: 'Alpha', party: pid, leader: ALPHA, at: 1000 }]);
    expect(feeds(b)).toEqual(['Alpha asks you to their party']);
    expect(b.link.api.accept(ALPHA)).toBe(true);
    expect(ids(a)).toEqual([ALPHA, BRAVO]);
    expect(b.link.snapshot()).toMatchObject({ party: { id: pid, leader: ALPHA, epoch: 2, members: [{ id: ALPHA, name: 'Alpha', present: true, leader: true, you: false }, { id: BRAVO, present: true, leader: false, you: true }] }, invites: [] });
    expect(a.peers.get(BRAVO).mate).toBe(true);
    expect(b.peers.get(ALPHA).mate).toBe(true);
    expect(b.peers.get(ALPHA).pt).toBe(pid);
    expect(feeds(a)).toContain('Bravo joined the party');
    expect(feeds(b)).toContain('You joined Alpha’s party');
    expect(b.link.helloField()).toEqual({ pt: pid });
    expect(a.seen).toContainEqual({ type: 'roster' }); // (a mate's drawn apart)
  });

  it('a member may ask someone in: the leader is told whom, and lets them in', () => {
    const { room, a, b } = twoOf();
    const c = room.join(CHARLIE, 'Charlie');
    room.meet();
    expect(b.link.api.invite(CHARLIE)).toBe(true);
    expect(c.link.snapshot().invites).toMatchObject([{ from: BRAVO, name: 'Bravo', leader: ALPHA }]);
    expect(c.link.api.accept(BRAVO)).toBe(true);
    for (const x of [a, b, c]) expect(ids(x)).toEqual([ALPHA, BRAVO, CHARLIE]);
    expect(feeds(b)).toContain('Charlie joined the party');
    expect(c.peers.get(BRAVO).mate).toBe(true);
  });

  it('lets no one in uninvited, takes a roster only from the leader, and no stranger naming the party is a mate', () => {
    const { room, a, b } = twoOf();
    const d = room.join(DELTA, 'Delta');
    const e = room.join(ECHO, 'Echo');
    room.meet();
    const pid = pidOf(a);
    room.say(DELTA, 'party', { t: 'join', p: pid }, ALPHA);
    expect(ids(a)).toEqual([ALPHA, BRAVO]);
    // a roster from Delta naming himself leader, and one from Bravo naming Alpha
    room.say(DELTA, 'party', { t: 'ros', p: pid, l: DELTA, e: 9, m: [[DELTA, 'Delta'], [BRAVO, 'Bravo']] });
    room.say(BRAVO, 'party', { t: 'ros', p: pid, l: ALPHA, e: 9, m: [[ALPHA, 'Alpha'], [BRAVO, 'Bravo'], [DELTA, 'Delta']] });
    expect(ids(a)).toEqual([ALPHA, BRAVO]);
    expect(ids(b)).toEqual([ALPHA, BRAVO]);
    expect(b.link.snapshot().party.epoch).toBe(2);
    // Delta's hello naming the party makes him nothing to it
    b.link.hello(b.peers.get(DELTA), { pt: pid }, false);
    expect(b.peers.get(DELTA).mate).toBe(false);
    expect(ids(d)).toBeNull();
    // nor an invite from someone not in the party it names
    room.say(DELTA, 'party', { t: 'inv', p: pid, l: ALPHA }, ECHO);
    expect(e.link.snapshot().invites).toEqual([]);
  });

  it('a no is told to whoever asked, and an ask again within a minute is turned away unseen', () => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha');
    const b = room.join(BRAVO, 'Bravo');
    room.meet();
    a.link.api.invite(BRAVO);
    expect(b.link.api.decline(ALPHA)).toBe(true);
    expect(b.link.snapshot().invites).toEqual([]);
    expect(feeds(a)).toContain('Bravo said no to the party');
    a.link.api.invite(BRAVO);
    expect(b.link.snapshot().invites).toEqual([]);
    expect(feeds(b).filter((t) => /asks you/.test(t))).toHaveLength(1);
    room.tick(61000);
    a.link.api.invite(BRAVO);
    expect(b.link.snapshot().invites).toHaveLength(1);
    expect(b.link.api.decline(CHARLIE)).toBe(false); // (no such invite)
  });

  it('an invite waits two minutes for an answer', () => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha');
    const b = room.join(BRAVO, 'Bravo');
    room.meet();
    a.link.api.invite(BRAVO);
    room.tick(60000);
    b.link.tick();
    expect(b.link.snapshot().invites).toHaveLength(1);
    room.tick(61000);
    b.link.tick();
    expect(b.link.snapshot().invites).toEqual([]);
    expect(b.link.api.accept(ALPHA)).toBe(false);
  });

  it('saying yes to another party leaves yours first', () => {
    const { room, a, b } = twoOf();
    const c = room.join(CHARLIE, 'Charlie');
    room.meet();
    c.link.api.invite(BRAVO);
    b.link.api.accept(CHARLIE);
    expect(ids(a)).toEqual([ALPHA]);
    expect(ids(b)).toEqual([CHARLIE, BRAVO]);
    expect(feeds(a)).toContain('Bravo left the party');
    expect(a.peers.get(BRAVO).mate).toBe(false);
  });

  it('asks no one blocked, unknown or in it already', () => {
    const { room, a } = twoOf();
    const c = room.join(CHARLIE, 'Charlie');
    room.meet();
    expect(a.link.api.invite(BRAVO)).toBe(false);
    expect(a.link.api.invite(DELTA)).toBe(false);
    expect(a.link.api.invite(ALPHA)).toBe(false);
    a.peers.get(CHARLIE).blocked = true;
    expect(a.link.api.invite(CHARLIE)).toBe(false);
    expect(c.link.snapshot().invites).toEqual([]);
  });

  it('a full party asks no one more, and turns a late yes away', () => {
    const room = createRoom();
    const [lead, ...rest] = [...'0123456789'].map((x) => room.join(x.repeat(64), `Pilot ${x}`));
    room.meet();
    for (const x of rest.slice(0, 6)) {
      lead.link.api.invite(x.id);
      x.link.api.accept(lead.id);
    }
    const [late, last, out] = rest.slice(6);
    rest[0].link.api.invite(late.id); // (asked by a member, the leader told)
    lead.link.api.invite(last.id);
    last.link.api.accept(lead.id);
    expect(ids(lead)).toHaveLength(8);
    expect(lead.link.api.invite(out.id)).toBe(false);
    expect(late.link.api.accept(rest[0].id)).toBe(true);
    expect(ids(lead)).toHaveLength(8);
    expect(ids(late)).toBeNull();
    expect(feeds(late)).toContain('Couldn’t join Pilot 0’s party');
  });
});

describe('the chat', () => {
  it('seals a line for each mate here, opened only by them, saying nothing else', async () => {
    const { room, a, b, c } = threeOf();
    const d = room.join(DELTA, 'Delta');
    room.meet();
    expect(await a.link.api.say('  Over the ridge  ')).toBe(true);
    await flush();
    expect(chats(a)).toEqual([{ from: ALPHA, name: 'Alpha', text: 'Over the ridge', at: 1000, mine: true }]);
    expect(chats(b)).toEqual([{ from: ALPHA, name: 'Alpha', text: 'Over the ridge', at: 1000, mine: false }]);
    expect(chats(c)).toHaveLength(1);
    expect(chats(d)).toEqual([]);
    const said = room.sent.filter((s) => s.ns === 'psay');
    expect(said).toHaveLength(1);
    expect(Object.keys(said[0].data)).toEqual(['b']);
    expect(said[0].data.b).toHaveLength(2);
    expect(said[0].to).toBeNull();
    // and back the other way
    room.tick(200);
    expect(await c.link.api.say('Right behind you')).toBe(true);
    await flush();
    expect(chats(a).at(-1)).toMatchObject({ from: CHARLIE, name: 'Charlie', text: 'Right behind you', mine: false });
  });

  it('drops a line from anyone not a mate unopened, and junk', async () => {
    const { room, a } = twoOf();
    room.join(DELTA, 'Delta');
    room.meet();
    const pid = pidOf(a);
    const opened = [];
    a.link.setCrypt({ ...crypt(ALPHA), open: (from, ...rest) => (opened.push(from), crypt(ALPHA).open(from, ...rest)) });
    room.say(DELTA, 'psay', { b: [blob([DELTA, ALPHA, pid, 'let me in'])] });
    for (const junk of [null, 'x', { b: [] }, { b: ['%%%'] }, { b: [blob(['nope'])] }, { b: [blob([BRAVO, ALPHA, 'ffffffffffffffff', 'elsewhere'])] }]) room.say(BRAVO, 'psay', junk);
    await flush();
    expect(chats(a)).toEqual([]);
    expect(opened).not.toContain(DELTA);
  });

  it('says nothing with no one to read it, no crypt, or no words; and cuts a long line', async () => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha');
    expect(await a.link.api.say('hello?')).toBe(false); // (no party)
    a.link.api.start();
    expect(await a.link.api.say('hello?')).toBe(false); // (no one here)
    const { a: x, b: y } = twoOf();
    expect(await x.link.api.say('   ')).toBe(false);
    expect(await x.link.api.say(42)).toBe(false);
    expect(await x.link.api.say('x'.repeat(CHAT_MAX + 50))).toBe(true);
    await flush();
    expect(chats(y)[0].text).toHaveLength(CHAT_MAX);
    x.link.setCrypt(null);
    expect(await x.link.api.say('sealed?')).toBe(false);
  });

  it('keeps within what the others take: never two lines a bundle, nor more than the rate', async () => {
    const { room, a } = twoOf();
    expect(await a.link.api.say('one')).toBe(true);
    expect(await a.link.api.say('two')).toBe(false);
    const said = [];
    for (let i = 0; i < 5; i++) {
      room.tick(200);
      said.push(await a.link.api.say(`line ${i}`));
    }
    expect(said).toEqual([true, true, true, false, true]);
  });

  it('drops a line from a mate who went while it was being opened', async () => {
    const { room, a, b } = twoOf();
    let open;
    a.link.setCrypt({ ...crypt(ALPHA), open: (...args) => new Promise((r) => (open = () => r(crypt(ALPHA).open(...args)))) });
    expect(await b.link.api.say('going now')).toBe(true);
    await flush();
    room.gone(BRAVO);
    open();
    await flush();
    expect(chats(a)).toEqual([]);
  });
});

describe('leaving, removing and leading', () => {
  it('a member who leaves is out of everyone’s party, and forgets it', () => {
    const store = createPartyStore();
    const { a, b, c } = threeOf({ b: { store } });
    expect(store.get().party.id).toBe(pidOf(a));
    expect(b.link.api.leave()).toBe(true);
    expect(ids(a)).toEqual([ALPHA, CHARLIE]);
    expect(ids(c)).toEqual([ALPHA, CHARLIE]);
    expect(ids(b)).toBeNull();
    expect(b.link.helloField()).toEqual({});
    expect(feeds(a)).toContain('Bravo left the party');
    expect(feeds(b)).toContain('You left the party');
    expect(a.peers.get(BRAVO).mate).toBe(false);
    expect(store.get()).toBeNull();
    expect(b.link.api.leave()).toBe(false);
  });

  it('a leader who leaves hands the lead to whoever’s here and has been in longest', () => {
    const { room, a, b, c } = threeOf();
    room.gone(BRAVO);
    a.link.api.leave();
    expect(c.link.snapshot().party).toMatchObject({ leader: CHARLIE, members: [{ id: BRAVO, present: false, where: null }, { id: CHARLIE, you: true }] });
    expect(feeds(c)).toContain('You lead the party now');
    expect(ids(a)).toBeNull();
    expect(ids(b)).toEqual([ALPHA, BRAVO, CHARLIE]); // (gone: it hears nothing)
  });

  it('the leader takes someone out, and they’re told', () => {
    const { room, a, b, c } = threeOf();
    expect(b.link.api.remove(CHARLIE)).toBe(false); // (only the leader)
    room.say(BRAVO, 'party', { t: 'out', p: pidOf(a) }, CHARLIE);
    expect(ids(c)).toEqual([ALPHA, BRAVO, CHARLIE]);
    expect(a.link.api.remove(CHARLIE)).toBe(true);
    expect(ids(c)).toBeNull();
    expect(feeds(c)).toContain('Alpha removed you from the party');
    expect(ids(b)).toEqual([ALPHA, BRAVO]);
    expect(feeds(b)).toContain('Charlie left the party');
    expect(feeds(a)).toContain('You removed Charlie from the party');
    expect(a.link.api.remove(CHARLIE)).toBe(false);
    expect(a.link.api.remove(ALPHA)).toBe(false); // (the leader leaves instead)
  });

  it('the leader hands the lead to another', () => {
    const { a, b, c } = threeOf();
    expect(b.link.api.promote(CHARLIE)).toBe(false);
    expect(a.link.api.promote(CHARLIE)).toBe(true);
    for (const x of [a, b, c]) expect(x.link.snapshot().party).toMatchObject({ leader: CHARLIE, epoch: 4 });
    expect(feeds(b)).toContain('Charlie leads the party now');
    expect(feeds(c)).toContain('You lead the party now');
    expect(a.link.api.promote(BRAVO)).toBe(false);
    expect(c.link.api.remove(ALPHA)).toBe(true);
  });

  it('the leader gone, the first here takes over; the old one back takes the newer roster', () => {
    const store = createPartyStore();
    const { room, b, c } = threeOf({ a: { store } });
    room.gone(ALPHA);
    expect(b.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 4 });
    expect(c.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 4 });
    expect(feeds(b)).toContain('You lead the party now');
    expect(feeds(c)).toContain('Bravo leads the party now');
    // Alpha's back, the party as he left it: leading, at epoch 3
    const a = room.join(ALPHA, 'Alpha', { store });
    expect(a.link.snapshot().party).toMatchObject({ leader: ALPHA, epoch: 3 });
    room.meet();
    for (const x of [a, b, c]) expect(x.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 4 });
    expect(a.peers.get(BRAVO).mate).toBe(true);
  });

  it('a leader whose hello names no party has gone from it: the next takes over', () => {
    const { a, b, c } = threeOf();
    a.link.hello(a.peers.get(BRAVO), {}, false); // (just joined: the hello may be one sent before)
    expect(ids(a)).toEqual([ALPHA, BRAVO, CHARLIE]);
    b.link.hello(b.peers.get(ALPHA), {}, false);
    expect(b.link.snapshot().party.leader).toBe(BRAVO);
    expect(c.link.snapshot().party.leader).toBe(BRAVO);
  });

  it('the leader drops a member whose hello names another party, once they’ve had time to hear the roster', () => {
    const { room, a, b } = twoOf();
    room.tick(21000);
    a.link.hello(a.peers.get(BRAVO), { pt: 'ffffffffffffffff' }, false);
    expect(ids(a)).toEqual([ALPHA]);
    expect(feeds(a)).toContain('Bravo left the party');
    expect(ids(b)).toBeNull(); // (the roster without them reached them)
  });

  it('at the heartbeat the leader’s roster goes out while anyone else is here', () => {
    const { room, a } = twoOf();
    const rosters = () => room.sent.filter((s) => s.from === ALPHA && s.data.t === 'ros' && !s.to).length;
    const before = rosters();
    a.link.tick();
    expect(rosters()).toBe(before + 1);
    room.gone(BRAVO);
    a.link.tick();
    expect(rosters()).toBe(before + 1);
  });

  it('a member behind is told the roster that’s newer', () => {
    const { room, a, b } = twoOf();
    const pid = pidOf(a);
    // Bravo thinks he leads, a while back: the leader puts him right
    room.say(BRAVO, 'party', { t: 'ros', p: pid, l: BRAVO, e: 1, m: [[BRAVO, 'Bravo'], [ALPHA, 'Alpha']] });
    expect(room.sent.at(-1)).toMatchObject({ from: ALPHA, to: BRAVO, data: { t: 'ros', l: ALPHA, e: 2 } });
    expect(b.link.snapshot().party.leader).toBe(ALPHA);
  });
});

describe('summons', () => {
  it('the leader summons the party to where they are; only the leader’s is heard', () => {
    const { room, a, b, c } = threeOf();
    a.self.where = '/middle-earth/bree';
    room.hello(a);
    expect(b.link.api.summon()).toBe(false);
    expect(a.link.api.summon()).toBe(true);
    const summons = (x) => x.seen.filter((e) => e.type === 'summon');
    expect(summons(b)).toEqual([{ type: 'summon', from: ALPHA, name: 'Alpha', where: '/middle-earth/bree' }]);
    expect(summons(c)).toHaveLength(1);
    expect(summons(a)).toEqual([]);
    expect(a.link.api.summon()).toBe(false); // (not again so soon)
    room.say(BRAVO, 'party', { t: 'sum', p: pidOf(a), w: '/universe' });
    expect(summons(c)).toHaveLength(1);
    expect(b.link.snapshot().party.members[0]).toMatchObject({ id: ALPHA, where: '/middle-earth/bree' });
  });

  it('follow the leader is a switch of your own', () => {
    const a = createRoom().join(ALPHA, 'Alpha');
    a.link.api.setFollow(true);
    expect(a.link.snapshot().follow).toBe(true);
    expect(a.seen).toContainEqual({ type: 'party' });
    a.link.api.setFollow(false);
    expect(a.link.snapshot().follow).toBe(false);
  });
});

describe('quick chat', () => {
  it('a quip is everyone’s, shown a while; mates and allies hear it in the feed', () => {
    const { room, a, b } = twoOf();
    const d = room.join(DELTA, 'Delta');
    room.meet();
    expect(a.link.api.quip(2)).toBe(true);
    for (const x of [a, b, d]) expect(x.link.quipOf(ALPHA)).toBe('On my way');
    expect(b.seen).toContainEqual({ type: 'quip', id: ALPHA, text: 'On my way' });
    expect(a.seen).toContainEqual({ type: 'quip', id: ALPHA, text: 'On my way' });
    expect(feeds(b)).toContain('Alpha: On my way');
    expect(feeds(d)).not.toContain('Alpha: On my way');
    d.peers.get(ALPHA).ally = 'ally';
    a.link.api.quip(0);
    expect(feeds(d)).toContain('Alpha: Hello');
    room.tick(QUIP_MS);
    expect(b.link.quipOf(ALPHA)).toBeNull();
    expect(a.link.quipOf(ALPHA)).toBeNull();
    expect(b.link.quipOf(DELTA)).toBeNull();
  });

  it('says only a line there is, and no more often than the others take', () => {
    const { a, b } = twoOf();
    expect(a.link.api.quip(99)).toBe(false);
    expect(a.link.api.quip('1')).toBe(false);
    expect([0, 1, 2, 3].map((i) => a.link.api.quip(i))).toEqual([true, true, true, false]);
    expect(b.link.quipOf(ALPHA)).toBe('On my way');
  });

  it('a quip from someone blocked is never shown', () => {
    const { room, a, b } = twoOf();
    a.link.api.quip(1);
    b.peers.get(ALPHA).blocked = true;
    expect(b.link.quipOf(ALPHA)).toBeNull();
    room.say(ALPHA, 'quip', { q: 3 });
    expect(b.link.quipOf(ALPHA)).toBeNull();
  });
});

describe('blocks', () => {
  it('a block takes them out if you lead, and you out if you don’t', () => {
    const { a, b, c } = threeOf();
    a.peers.get(CHARLIE).blocked = true;
    a.link.blocked(a.peers.get(CHARLIE), true);
    expect(ids(a)).toEqual([ALPHA, BRAVO]);
    expect(ids(c)).toBeNull();
    b.peers.get(ALPHA).blocked = true;
    b.link.blocked(b.peers.get(ALPHA), true);
    expect(ids(b)).toBeNull();
    expect(ids(a)).toEqual([ALPHA]);
    expect(b.peers.get(ALPHA).mate).toBe(false);
  });

  it('a flood’s mute takes no one out, but they’re no mate while it lasts', () => {
    const { a, b } = twoOf();
    a.peers.get(BRAVO).blocked = true;
    a.link.blocked(a.peers.get(BRAVO), true, true);
    expect(ids(a)).toEqual([ALPHA, BRAVO]);
    expect(ids(b)).toEqual([ALPHA, BRAVO]);
    expect(a.peers.get(BRAVO).mate).toBe(false);
    a.peers.get(BRAVO).blocked = false;
    a.link.blocked(a.peers.get(BRAVO), false);
    expect(a.peers.get(BRAVO).mate).toBe(false); // (till their next hello says)
  });

  it('nothing from a blocked pilot is heard: no invite, no roster, no summons', () => {
    const { room, a, b } = twoOf();
    const pid = pidOf(a);
    b.peers.get(ALPHA).blocked = true; // (blocked as client.js's admit has it, the link not told)
    room.say(ALPHA, 'party', { t: 'sum', p: pid, w: '/universe' });
    room.say(ALPHA, 'party', { t: 'ros', p: pid, l: ALPHA, e: 9, m: [[ALPHA, 'Alpha']] });
    expect(b.seen.filter((e) => e.type === 'summon')).toEqual([]);
    expect(ids(b)).toEqual([ALPHA, BRAVO]);
  });
});

describe('remembered (partyStore.js)', () => {
  it('kept, and yours again next visit on the same key, alone till the others come', () => {
    const store = createPartyStore();
    const { a } = twoOf({ a: { store } });
    const pid = pidOf(a);
    expect(store.get()).toMatchObject({ as: ALPHA.slice(0, 16), party: { id: pid, members: [{ id: ALPHA }, { id: BRAVO }] } });
    const again = createRoom().join(ALPHA, 'Alpha', { store });
    expect(again.link.snapshot().party).toMatchObject({ id: pid, leader: ALPHA, members: [{ id: ALPHA, present: true }, { id: BRAVO, present: false, where: null }] });
    expect(again.link.helloField()).toEqual({ pt: pid });
    // another key's isn't yours, nor is it forgotten by you
    const guest = createRoom().join(DELTA, 'Delta', { store });
    expect(guest.link.snapshot().party).toBeNull();
    guest.link.api.start(); // (a guest tab's party, kept over Alpha's a moment)
    again.link.tick(); // (Alpha's tab keeps his again, at its heartbeat)
    guest.link.api.leave();
    expect(store.get()).toMatchObject({ as: ALPHA.slice(0, 16), party: { id: pid } });
  });

  it('kept while you’re in it, forgotten once you’re removed', () => {
    const store = createPartyStore();
    const { a } = threeOf({ c: { store } });
    expect(store.get().party.members).toHaveLength(3);
    a.link.api.remove(CHARLIE);
    expect(store.get()).toBeNull();
  });
});

describe('junk', () => {
  it('nothing a stranger or junk sends throws or changes the party', async () => {
    const { room, a, b } = twoOf();
    const pid = pidOf(a);
    const before = JSON.stringify([a.link.snapshot(), b.link.snapshot()]);
    const junk = [null, 1, 'x', [], {}, { t: 'ros' }, { t: '__proto__', p: pid }, { t: 'toString', p: pid }, { t: 'inv', p: pid, l: 'nope' }, { t: 'join', p: pid.toUpperCase() }, { t: 'ros', p: pid, l: ALPHA, e: 99, m: [[ALPHA, 'A'], [ALPHA, 'A']] }, { t: 'ros', p: pid, l: ALPHA, e: 1.5, m: [[ALPHA, 'A']] }, { t: 'out', p: 'zz' }, { t: 'sum', p: pid, w: 'javascript:' }, { b: 'x' }, { q: -1 }];
    for (const j of junk) {
      for (const ns of ['party', 'psay', 'quip']) {
        expect(() => room.say(BRAVO, ns, j)).not.toThrow();
        expect(() => room.say(ECHO, ns, j, ALPHA)).not.toThrow(); // (no one a knows)
      }
    }
    // a pilot unknown, even one using the party's words right
    room.say(ECHO, 'party', { t: 'out', p: pid }, BRAVO);
    room.say(ECHO, 'party', { t: 'ros', p: pid, l: ECHO, e: 50, m: [[ECHO, 'Echo']] });
    await flush();
    expect(JSON.stringify([a.link.snapshot(), b.link.snapshot()])).toBe(before);
    expect(() => a.link.hello(null, null, true)).not.toThrow();
    expect(() => a.link.gone(null)).not.toThrow();
    expect(() => a.link.blocked(null, true)).not.toThrow();
  });

  it('does nothing before it’s wired or once it’s disposed', async () => {
    const link = createPartyLink({ self: { id: null, name: 'Alpha', where: '/universe' }, peers: new Map(), emit: () => {}, feed: () => {}, roster: () => {}, now: () => 0 });
    expect(link.api.start()).toBe(false);
    expect(link.api.invite(BRAVO)).toBe(false);
    expect(link.api.quip(0)).toBe(false);
    expect(await link.api.say('hi')).toBe(false);
    expect(() => link.tick()).not.toThrow();
    const { room, a } = twoOf();
    const n = room.sent.length;
    a.link.dispose();
    expect(a.link.snapshot()).toEqual({ party: null, invites: [], follow: false });
    expect(a.link.api.quip(0)).toBe(false);
    expect(a.link.api.start()).toBe(false);
    a.link.tick();
    expect(room.sent.length).toBe(n);
  });
});
