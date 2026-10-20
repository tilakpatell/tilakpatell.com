import { describe, expect, it } from 'vitest';
import { createPartyLink } from './partyLink';
import { createPartyStore } from './partyStore';
import { beat, blob, close, createRoom, crypt, flush, unblob } from './fixtures/partyRoom';
import { CHAT_MAX } from './partyWire';
import { QUIP_MS } from './quips';

// (a pilot’s id is their key: 64 hex digits)
const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO] = ['a', 'b', 'c', 'd', 'e'].map((x) => x.repeat(64));
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
    expect(a.link.helloField()).toEqual({ pt: '0101010101010101', pe: 1 });
    expect(a.link.api.start()).toBe(false); // (one at a time)
    expect(a.seen).toContainEqual({ type: 'party' });
  });

  it('an invite said yes to: both in it, mates, each told', () => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha');
    const b = room.join(BRAVO, 'Bravo');
    room.meet();
    expect(a.link.api.invite(BRAVO)).toBe(true); // (no party yet: one’s started, Alpha leading)
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
    expect(b.link.helloField()).toEqual({ pt: pid, pe: 2 });
    expect(a.seen).toContainEqual({ type: 'roster' }); // (a mate’s drawn apart)
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
    // Delta’s hello naming the party makes him nothing to it
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
    // (each line names the party it was said in, so one from a party since left is told apart)
    const party = pidOf(a);
    expect(chats(a)).toEqual([{ from: ALPHA, name: 'Alpha', text: 'Over the ridge', at: 1000, mine: true, party }]);
    expect(chats(b)).toEqual([{ from: ALPHA, name: 'Alpha', text: 'Over the ridge', at: 1000, mine: false, party }]);
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
    expect(chats(a).at(-1)).toMatchObject({ from: CHARLIE, name: 'Charlie', text: 'Right behind you', mine: false, party });
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
    expect(store.get(BRAVO).party.id).toBe(pidOf(a));
    expect(b.link.api.leave()).toBe(true);
    expect(ids(a)).toEqual([ALPHA, CHARLIE]);
    expect(ids(c)).toEqual([ALPHA, CHARLIE]);
    expect(ids(b)).toBeNull();
    expect(b.link.helloField()).toEqual({});
    expect(feeds(a)).toContain('Bravo left the party');
    expect(feeds(b)).toContain('You left the party');
    expect(a.peers.get(BRAVO).mate).toBe(false);
    expect(store.get(BRAVO)).toBeNull();
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

  it('the lead goes only to a member who’s here, as the dialog offers it: one away would come back to a lead they never had, and could take the party apart', () => {
    const { room, a, c } = threeOf();
    close(room, c);
    expect(a.link.api.promote(CHARLIE)).toBe(false);
    expect(a.link.api.promote(BRAVO)).toBe(true);
  });

  it('the leader gone, the first here takes over; the old one back takes the newer roster', () => {
    const store = createPartyStore();
    const { room, b, c } = threeOf({ a: { store } });
    room.gone(ALPHA);
    expect(b.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 4 });
    expect(c.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 4 });
    expect(feeds(b)).toContain('You lead the party now');
    expect(feeds(c)).toContain('Bravo leads the party now');
    // Alpha’s back, the party as he left it: leading, at epoch 3
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
    b.peers.get(ALPHA).blocked = true; // (blocked as client.js’s admit has it, the link not told)
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
    expect(store.get(ALPHA)).toMatchObject({ as: ALPHA.slice(0, 16), party: { id: pid, members: [{ id: ALPHA }, { id: BRAVO }] } });
    const again = createRoom().join(ALPHA, 'Alpha', { store });
    expect(again.link.snapshot().party).toMatchObject({ id: pid, leader: ALPHA, members: [{ id: ALPHA, present: true }, { id: BRAVO, present: false, where: null }] });
    expect(again.link.helloField()).toEqual({ pt: pid, pe: 2 });
  });

  it('a guest tab’s party, on the same browser, never takes the place of your key’s', () => {
    // Alpha’s tab is closed first, the guest tab (a key of its own) last: Alpha’s party is his again
    const store = createPartyStore();
    const room = createRoom();
    const b = room.join(BRAVO, 'Bravo');
    const a = room.join(ALPHA, 'Alpha', { store });
    room.meet();
    b.link.api.invite(ALPHA);
    a.link.api.accept(BRAVO);
    const pid = pidOf(b);
    const guest = room.join(DELTA, 'Delta', { store });
    expect(guest.link.snapshot().party).toBeNull();
    guest.link.api.start();
    close(room, a);
    guest.link.tick();
    guest.link.dispose();
    const back = room.join(ALPHA, 'Alpha', { store });
    room.meet();
    expect(pidOf(back)).toBe(pid);
    expect(ids(b)).toEqual([BRAVO, ALPHA]);
    expect(store.get(DELTA).party.id).not.toBe(pid);
  });

  it('kept while you’re in it, forgotten once you’re removed', () => {
    const store = createPartyStore();
    const { a } = threeOf({ c: { store } });
    expect(store.get(CHARLIE).party.members).toHaveLength(3);
    a.link.api.remove(CHARLIE);
    expect(store.get(CHARLIE)).toBeNull();
  });
});

// Back from last visit with the party as you left it, while it changed without you
describe('catching up', () => {
  // Alpha leads, Bravo (remembering it) goes, Alpha lets Charlie in: each case then brings Bravo back
  function away() {
    const stores = { a: createPartyStore(), b: createPartyStore(), c: createPartyStore() };
    const { room, a, b } = twoOf({ a: { store: stores.a }, b: { store: stores.b } });
    close(room, b);
    const c = room.join(CHARLIE, 'Charlie', { store: stores.c });
    room.meet();
    a.link.api.invite(CHARLIE);
    c.link.api.accept(ALPHA);
    const back = () => room.join(BRAVO, 'Bravo', { store: stores.b });
    return { room, a, c, stores, back };
  }
  const caughtUp = async (room, b, c, view) => {
    expect(b.link.snapshot().party).toMatchObject(view);
    expect([b.peers.get(CHARLIE).mate, c.peers.get(BRAVO).mate]).toEqual([true, true]);
    room.tick(1000);
    expect(await c.link.api.say('Welcome back')).toBe(true);
    await flush();
    expect(chats(b).map((l) => l.text)).toEqual(['Welcome back']);
  };

  it('a leader made while you were away, someone you’ve never met: the one you know tells you', async () => {
    const { room, a, c, back } = away();
    a.link.api.promote(CHARLIE);
    const b = back();
    room.hello(b); // (Bravo’s hello first: Alpha’s roster reaches him before Alpha’s hello, and is lost, so it’s sent again a heartbeat on)
    room.meet();
    beat(room, [a, b, c]);
    await caughtUp(room, b, c, { leader: CHARLIE, epoch: 4 });
  });

  it('a leader who handed over and left: they still tell you, while they’re online', async () => {
    const { room, a, c, back } = away();
    a.link.api.leave();
    const b = back();
    room.meet();
    beat(room, [a, b, c]);
    await caughtUp(room, b, c, { leader: CHARLIE, epoch: 5, members: [{ id: BRAVO }, { id: CHARLIE }] });
  });

  it('the leader gone too and the next one took over: you wait alone, without leading, till one you know comes', async () => {
    const { room, a, c, stores, back } = away();
    close(room, a);
    expect(c.link.snapshot().party).toMatchObject({ leader: CHARLIE, epoch: 4 });
    const b = back();
    room.meet();
    beat(room, [b, c]);
    expect(b.link.snapshot().party).toMatchObject({ leader: ALPHA, epoch: 2 }); // (no epoch of his own)
    const a2 = room.join(ALPHA, 'Alpha', { store: stores.a });
    room.meet();
    beat(room, [a2, b, c]);
    for (const x of [a2, c]) expect(x.link.snapshot().party).toMatchObject({ leader: CHARLIE, epoch: 4 });
    await caughtUp(room, b, c, { leader: CHARLIE, epoch: 4 });
  });

  it('a takeover from a stale roster never puts out one the live roster has', () => {
    // Bravo leads, Alpha in; Alpha goes; Charlie in; all go. Back: Alpha (alone), Charlie, Bravo.
    const [sa, sb, sc] = [createPartyStore(), createPartyStore(), createPartyStore()];
    const room = createRoom();
    const b = room.join(BRAVO, 'Bravo', { store: sb });
    const a = room.join(ALPHA, 'Alpha', { store: sa });
    room.meet();
    b.link.api.invite(ALPHA);
    a.link.api.accept(BRAVO);
    close(room, a);
    const c = room.join(CHARLIE, 'Charlie', { store: sc });
    room.meet();
    b.link.api.invite(CHARLIE);
    c.link.api.accept(BRAVO);
    for (const x of [c, b]) close(room, x);
    const again = createRoom();
    const back = [];
    for (const [id, name, store] of [[ALPHA, 'Alpha', sa], [CHARLIE, 'Charlie', sc], [BRAVO, 'Bravo', sb]]) {
      back.push(again.join(id, name, { store }));
      again.meet();
      beat(again, back);
    }
    for (const x of back) expect(x.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 3, members: [{ id: BRAVO }, { id: ALPHA }, { id: CHARLIE }] });
    expect(feeds(back[1])).not.toContain('You’re no longer in the party');
  });

  it('removed while away: the leader, alone with you, says so', () => {
    const store = createPartyStore();
    const { room, a, b } = twoOf({ b: { store } });
    close(room, b);
    a.link.api.remove(BRAVO); // (the out and the roster reach no one)
    const b2 = room.join(BRAVO, 'Bravo', { store });
    expect(ids(b2)).toEqual([ALPHA, BRAVO]);
    room.hello(b2); // (his hello first: the roster Alpha sends him is lost, unread, so it’s sent again a heartbeat on)
    room.meet();
    beat(room, [a, b2], 1);
    expect(ids(b2)).toBeNull();
    expect(feeds(b2)).toContain('You’re no longer in the party');
    expect(store.get(BRAVO)).toBeNull();
    expect([a.peers.get(BRAVO).mate, b2.peers.get(ALPHA).mate]).toEqual([false, false]);
  });

  it('removed while away by a leader you never followed: no takeover over it, and the one you did says so once back', () => {
    const stores = { a: createPartyStore(), b: createPartyStore() };
    const { room, a, b, c } = threeOf({ a: { store: stores.a }, b: { store: stores.b } });
    close(room, b);
    close(room, a); // (Charlie, left alone, leads)
    expect(c.link.api.remove(BRAVO)).toBe(true);
    const b2 = room.join(BRAVO, 'Bravo', { store: stores.b });
    room.meet();
    beat(room, [b2, c]);
    expect(b2.link.snapshot().party).toMatchObject({ leader: ALPHA, epoch: 3 });
    const a2 = room.join(ALPHA, 'Alpha', { store: stores.a });
    room.meet();
    beat(room, [a2, b2, c]);
    expect(ids(b2)).toBeNull();
    expect(ids(a2)).toEqual([ALPHA, CHARLIE]);
  });
});

describe('what a pilot can’t make you do', () => {
  it('a roster taken on a member’s word isn’t passed on, till the leader you had shows they’ve nothing newer to say', () => {
    const { room, a, b, c } = threeOf();
    const pid = pidOf(a);
    close(room, a); // (Bravo takes over: Charlie takes his word, the leader he had, Alpha, gone)
    const d = room.join(DELTA, 'Delta');
    room.meet();
    b.link.api.invite(DELTA);
    d.link.api.accept(BRAVO);
    expect(c.link.snapshot().party).toMatchObject({ leader: BRAVO, epoch: 5 });
    // Alpha, as Charlie alone hears him: at epoch 4 he’s moved on since (he may have put Bravo out), at 3 he hasn’t
    const alpha = { id: ALPHA, name: 'Alpha', where: '/universe', blocked: false, ally: 'none', mate: false, pt: null, quip: null };
    c.peers.set(ALPHA, alpha);
    const told = () => room.sent.filter((x) => x.from === CHARLIE && x.to === ALPHA && x.data.t === 'ros').length;
    c.link.hello(alpha, { pt: pid, pe: 4 }, true);
    expect(told()).toBe(0);
    c.link.hello(alpha, { pt: pid, pe: 3 }, false);
    expect(told()).toBe(1);
  });

  it('a pilot removed while you were away can’t keep you: the leader you had, back, puts it right', async () => {
    // Alpha leads Bravo, Charlie and Delta; Bravo goes; Alpha removes Charlie, makes Delta leader; all go
    const stores = { a: createPartyStore(), b: createPartyStore(), d: createPartyStore() };
    const { room, a, b, c } = threeOf({ a: { store: stores.a }, b: { store: stores.b } });
    const d = room.join(DELTA, 'Delta', { store: stores.d });
    room.meet();
    a.link.api.invite(DELTA);
    d.link.api.accept(ALPHA);
    const pid = pidOf(a);
    close(room, b);
    a.link.api.remove(CHARLIE);
    a.link.api.promote(DELTA);
    for (const x of [a, c, d]) close(room, x);
    // Charlie’s client, changed (no link here: his words are the test’s), names the party to Bravo, back
    const b2 = room.join(BRAVO, 'Bravo', { store: stores.b });
    const charlie = { id: CHARLIE, name: 'Charlie', where: '/universe', blocked: false, ally: 'none', mate: false, pt: null, quip: null };
    b2.peers.set(CHARLIE, charlie);
    b2.link.hello(charlie, { pt: pid, pe: 9 }, true);
    // and says he leads it: past EPOCH_SPAN he isn’t believed, within it he is
    const lead = (e) => room.say(CHARLIE, 'party', { t: 'ros', p: pid, l: CHARLIE, e, m: [[CHARLIE, 'Charlie'], [ALPHA, 'Alpha'], [BRAVO, 'Bravo'], [DELTA, 'Delta']] }, BRAVO);
    lead(Number.MAX_SAFE_INTEGER - 1);
    expect(b2.link.snapshot().party.epoch).toBe(4);
    lead(9);
    expect(b2.link.snapshot().party).toMatchObject({ leader: CHARLIE, epoch: 9 });
    // Alpha and Delta back (Delta leading): Bravo takes Alpha’s word over Charlie’s (Delta’s isn’t the one he had), neither takes Charlie’s, and no line’s sealed for Charlie
    const back = [ALPHA, DELTA].map((id, i) => room.join(id, ['Alpha', 'Delta'][i], { store: [stores.a, stores.d][i] }));
    room.meet();
    beat(room, [...back, b2]);
    for (const x of [...back, b2]) expect(x.link.snapshot().party).toMatchObject({ leader: DELTA, epoch: 6, members: [{ id: ALPHA }, { id: BRAVO }, { id: DELTA }] });
    expect(await b2.link.api.say('Just us')).toBe(true);
    expect(room.sent.filter((x) => x.ns === 'psay').at(-1).data.b.map((x) => unblob(x)[1]).sort()).toEqual([ALPHA, DELTA]);
  });

  it('an invite is to one party: a yes to the leader’s next one is turned away', () => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha');
    room.join(BRAVO, 'Bravo');
    room.join(CHARLIE, 'Charlie');
    room.meet();
    a.link.api.invite(BRAVO); // (party one: Bravo asked, and says nothing yet)
    const first = pidOf(a);
    a.link.api.leave();
    a.link.api.invite(CHARLIE); // (party two)
    expect(pidOf(a)).not.toBe(first);
    room.say(BRAVO, 'party', { t: 'join', p: pidOf(a) }, ALPHA);
    expect(ids(a)).toEqual([ALPHA]);
    expect(room.sent.at(-1)).toMatchObject({ from: ALPHA, to: BRAVO, data: { t: 'no', p: pidOf(a) } });
  });

  it('a yes keeps your party till the new one’s roster lets you in: a forged invite costs you nothing', () => {
    const { room, a, b } = twoOf();
    const d = room.join(DELTA, 'Delta');
    room.join(ECHO, 'Echo');
    room.meet();
    d.link.api.start();
    // Echo, in no party, names Delta’s in his hello and asks Bravo to it
    b.link.hello(b.peers.get(ECHO), { pt: pidOf(d), pe: 1 }, false);
    room.say(ECHO, 'party', { t: 'inv', p: pidOf(d), l: DELTA }, BRAVO);
    expect(b.link.api.accept(ECHO)).toBe(true);
    for (const x of [a, b]) expect(ids(x)).toEqual([ALPHA, BRAVO]);
    expect(feeds(b)).toContain('Couldn’t join Delta’s party'); // (Delta never asked him, and says so)
    expect(feeds(b)).not.toContain('You left the party');
  });

  it('a yes never answered is given up after two minutes, and said so', () => {
    const { room, b } = twoOf();
    const c = room.join(CHARLIE, 'Charlie');
    room.meet();
    c.link.api.invite(BRAVO);
    c.link.dispose(); // (Charlie’s tab froze: in the room, saying nothing)
    expect(b.link.api.accept(CHARLIE)).toBe(true);
    room.tick(121000);
    b.link.tick();
    expect(feeds(b)).toContain('Couldn’t join Charlie’s party');
    expect(ids(b)).toEqual([ALPHA, BRAVO]);
    // (and one whose leader goes offline before answering, at once)
    const d = room.join(DELTA, 'Delta');
    room.meet();
    d.link.api.invite(BRAVO);
    d.link.dispose();
    b.link.api.accept(DELTA);
    room.gone(DELTA);
    expect(feeds(b)).toContain('Couldn’t join Delta’s party');
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
    // a pilot unknown, even one using the party’s words right
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
