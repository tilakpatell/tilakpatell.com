// What a changed client can’t do to a party through the link, past
// partyLink.test.js’s own (kept apart, as that file is near its size): one
// gone from it, back with words of their own, and a stranger asking for rosters.
import { describe, expect, it } from 'vitest';
import { createPartyStore } from './partyStore';
import { beat, close, createRoom, unblob } from './fixtures/partyRoom';

const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO] = ['a', 'b', 'c', 'd', 'e'].map((x) => x.repeat(64));
const ids = (a) => a.link.snapshot().party?.members.map((m) => m.id) ?? null;
const pidOf = (a) => a.link.helloField().pt;
// a pilot whose words are the test’s (no link): their row, as one who hears their hello keeps it
const rowOf = (id, name) => ({ id, name, where: '/universe', blocked: false, ally: 'none', mate: false, pt: null, pe: null, quip: null });
// Alpha leads Bravo, Charlie and Delta, each with a link (Bravo’s remembering it)
function four(stores) {
  const room = createRoom();
  const a = room.join(ALPHA, 'Alpha', { store: stores.a });
  const b = room.join(BRAVO, 'Bravo', { store: stores.b });
  const c = room.join(CHARLIE, 'Charlie');
  const d = room.join(DELTA, 'Delta', { store: stores.d });
  room.meet();
  for (const x of [b, c, d]) {
    a.link.api.invite(x.id);
    x.link.api.accept(ALPHA);
  }
  return { room, a, b, c, d, pid: pidOf(a) };
}
// Bravo back from the store, and Charlie’s client, changed, reaching him first with rosters of its own
function charlieFirst(room, stores, pid, rosters) {
  const b2 = room.join(BRAVO, 'Bravo', { store: stores.b });
  const charlie = rowOf(CHARLIE, 'Charlie');
  b2.peers.set(CHARLIE, charlie);
  b2.link.hello(charlie, { pt: pid, pe: 7 }, true);
  const m = [[ALPHA, 'Alpha'], [BRAVO, 'Bravo'], [CHARLIE, 'Charlie'], [DELTA, 'Delta']];
  for (const [l, e] of rosters) room.say(CHARLIE, 'party', { t: 'ros', p: pid, l, e, m }, BRAVO);
  room.meet();
  return b2;
}

describe('one gone from it, back with a changed client', () => {
  // Bravo goes; Alpha puts Charlie out, and goes; Delta, who saw it, leads
  for (const [who, l] of [
    ['Charlie leading it', CHARLIE],
    ['Delta leading it', DELTA],
    ['Bravo leading it (so Bravo would pass it on as its leader)', BRAVO],
  ])
    it(`one Bravo knew before, who saw it, puts Bravo right, and isn’t taken in: ${who}`, async () => {
      const stores = { a: createPartyStore(), b: createPartyStore(), d: createPartyStore() };
      const { room, a, b, c, d, pid } = four(stores);
      close(room, b);
      a.link.api.remove(CHARLIE);
      close(room, c);
      close(room, a);
      expect(d.link.snapshot().party).toMatchObject({ leader: DELTA, epoch: 6 });
      const b2 = charlieFirst(room, stores, pid, [[l, 7]]);
      beat(room, [b2, d]);
      for (const x of [b2, d]) expect(x.link.snapshot().party).toMatchObject({ leader: DELTA, epoch: 6, members: [{ id: ALPHA }, { id: BRAVO }, { id: DELTA }] });
      room.tick(1000);
      expect(await b2.link.api.say('Back')).toBe(true);
      expect(room.sent.filter((x) => x.ns === 'psay').at(-1).data.b.map((x) => unblob(x)[1])).toEqual([DELTA]);
    });

  // Bravo goes; Charlie leaves; Charlie, as Bravo hears him, leads, and then makes Bravo leader
  for (const [how, go] of [
    ['leaving', (room, a, c) => c.link.api.leave()],
    // (his goodbye lost: his hello, naming no party, says it, a while after he came in)
    ['his goodbye lost', (room, a) => (room.tick(21000), a.link.hello(a.peers.get(CHARLIE), { n: 'Charlie' }, false))],
  ])
    it(`one who left is no more brought back to the leader’s party than one put out: the leader saw them go too (${how})`, () => {
      const stores = { b: createPartyStore() };
      const { room, a, b, c, d, pid } = four(stores);
      close(room, b);
      go(room, a, c);
      close(room, c);
      const b2 = charlieFirst(room, stores, pid, [
        [CHARLIE, 6],
        [BRAVO, 7],
      ]);
      beat(room, [a, b2, d]);
      for (const x of [a, b2, d]) expect(x.link.snapshot().party).toMatchObject({ leader: ALPHA, epoch: 5, members: [{ id: ALPHA }, { id: BRAVO }, { id: DELTA }] });
    });

  it('a member’s word never brings back one you saw put out; your leader’s does (asked in again)', () => {
    const { room, a, b, c, pid } = four({});
    const takeover = (e, m) => room.say(DELTA, 'party', { t: 'ros', p: pid, l: DELTA, e, m: m.map((id) => [id, id[0]]) }, BRAVO);
    a.link.api.remove(CHARLIE);
    takeover(9, [ALPHA, BRAVO, CHARLIE, DELTA]);
    expect(b.link.snapshot().party).toMatchObject({ leader: ALPHA, epoch: 5 });
    a.link.api.invite(CHARLIE);
    c.link.api.accept(ALPHA);
    expect(ids(b)).toEqual([ALPHA, BRAVO, DELTA, CHARLIE]);
    // (and a member’s word that keeps him, or brings back no one, stands as it did)
    takeover(9, [ALPHA, BRAVO, DELTA, CHARLIE]);
    expect(b.link.snapshot().party).toMatchObject({ leader: DELTA, epoch: 9 });
  });
});

describe('a stranger asking for rosters', () => {
  it('one naming the party, hello on hello, is told it once a while, not at each', () => {
    const room = createRoom();
    const a = room.join(ALPHA, 'Alpha');
    const b = room.join(BRAVO, 'Bravo');
    room.meet();
    a.link.api.invite(BRAVO);
    b.link.api.accept(ALPHA);
    const echo = rowOf(ECHO, 'Echo');
    a.peers.set(ECHO, echo);
    const told = () => room.sent.filter((x) => x.from === ALPHA && x.to === ECHO && x.data.t === 'ros').length;
    for (let i = 0; i < 8; i++) {
      room.tick(1000);
      a.link.hello(echo, i % 2 ? {} : { pt: pidOf(a), pe: 1 }, i === 0);
    }
    expect(told()).toBe(1);
    room.tick(10000);
    a.link.hello(echo, { pt: pidOf(a), pe: 1 }, false);
    expect(told()).toBe(2); // (and again a while on: the first may have been lost)
  });
});
